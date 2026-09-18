import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BUILTIN_ROLES, BUILTIN_SOURCES, CLAUDE_DIR, ROLES_MARKER } from '../constants.ts';
import { rolesOf, type Source } from './sources.ts';
import { readJson } from '../utils.ts';

/** A server this project can reach, and the scope it was found in. */
export interface Server {
  id: string;
  source: 'project' | 'user' | 'plugin';
}

/** Role → the id of the server that fills it. A role nothing fills is absent. */
export type Mapping = Record<string, string>;

/** As much of a source as matching a server to a role needs. */
type Routable = Pick<Source, 'role'> & { server?: readonly string[] };

/** The parts of Claude Code's settings files read here. Nothing in them is trusted. */
interface ClaudeSettings {
  enabledPlugins?: Record<string, boolean>;
  mcpServers?: unknown;
}

/** Where Claude Code keeps its own configuration, inside the user's home. */
const claudeHome = (home: string, ...parts: string[]) => path.join(home, CLAUDE_DIR, ...parts);

/**
 * Server maps come in two shapes: `{ mcpServers: {…} }` in Claude's own configs,
 * and a bare `{ name: {…} }` map in plugin .mcp.json files.
 */
function serverNames(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const { mcpServers } = data as { mcpServers?: unknown };
  const map = (mcpServers && typeof mcpServers === 'object' ? mcpServers : data) as Record<string, unknown>;

  // A declared server with an empty url is a placeholder, not something to reach.
  return Object.keys(map).filter((key) => {
    const server = map[key];
    return Boolean(server) && typeof server === 'object' && (server as { url?: unknown }).url !== '';
  });
}

function pluginServers(home: string): Server[] {
  // Both files, for the same reason detectServers reads both: a plugin turned on
  // for this machine alone lands in the local one.
  const enabledIn = (file: string) =>
    Object.entries(readJson<ClaudeSettings>(claudeHome(home, file))?.enabledPlugins ?? {});
  const enabled = [...enabledIn('settings.json'), ...enabledIn('settings.local.json')]
    .filter(([, on]) => on)
    .map(([key]) => key.split('@')[0] ?? key);

  const marketplaces = claudeHome(home, 'plugins', 'marketplaces');
  const found: Server[] = [];

  for (const plugin of enabled) {
    for (const dir of ['external_plugins', 'plugins']) {
      // The marketplace directory in the middle is whatever the user installed from.
      for (const file of fs.globSync(path.join(marketplaces, '*', dir, plugin, '.mcp.json'))) {
        for (const name of serverNames(readJson(file))) {
          found.push({ id: `plugin:${plugin}:${name}`, source: 'plugin' });
        }
      }
    }
  }

  return found;
}

/** Directory names inside `dir`, or nothing when it does not exist. */
function subdirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

/**
 * Where the Claude desktop app keeps the plugins it installed. Every platform is
 * checked on every platform: the miss costs one failed readdir, and a home moved
 * between systems still resolves.
 */
function desktopRoots(home: string): string[] {
  const tail = ['Claude', 'local-agent-mode-sessions'];
  return [
    path.join(home, 'Library', 'Application Support', ...tail),
    path.join(home, 'AppData', 'Roaming', ...tail),
    path.join(home, '.config', ...tail),
  ];
}

/** What the desktop app's rpm/manifest.json says about one installed plugin. */
interface DesktopPlugin {
  id?: string;
  name?: string;
  installationPreference?: string;
}

/**
 * Servers from plugins installed through the desktop app, which keeps them
 * outside `~/.claude` — under `<root>/<session>/<run>/rpm`, where `manifest.json`
 * names each plugin and `plugin_<id>/.mcp.json` lists its servers. Ids come out
 * in the same `plugin:<plugin>:<server>` shape the CLI uses.
 */
function desktopPlugins(home: string): Server[] {
  const found: Server[] = [];

  for (const root of desktopRoots(home)) {
    for (const session of subdirs(root)) {
      for (const run of subdirs(session)) {
        const rpm = path.join(run, 'rpm');
        const manifest = readJson<{ plugins?: (DesktopPlugin | null)[] }>(path.join(rpm, 'manifest.json'));

        for (const plugin of manifest?.plugins ?? []) {
          if (!plugin?.id || !plugin?.name) continue;
          if (plugin.installationPreference === 'disabled') continue;

          // The directory is named by the id, which already carries its `plugin_` prefix.
          for (const name of serverNames(readJson(path.join(rpm, plugin.id, '.mcp.json')))) {
            found.push({ id: `plugin:${plugin.name}:${name}`, source: 'plugin' });
          }
        }
      }
    }
  }

  return found;
}

/**
 * Every MCP server this project could already reach, nearest scope first.
 * Duplicate ids collapse onto the closest one.
 */
export function detectServers(root: string, { home = os.homedir() }: { home?: string } = {}): Server[] {
  const found: Server[] = [];

  for (const name of serverNames(readJson(path.join(root, '.mcp.json')))) {
    found.push({ id: name, source: 'project' });
  }

  const userConfig =
    readJson<{ mcpServers?: unknown; projects?: Record<string, { mcpServers?: unknown }> }>(
      path.join(home, '.claude.json'),
    ) ?? {};
  for (const name of serverNames({ mcpServers: userConfig.mcpServers })) {
    found.push({ id: name, source: 'user' });
  }
  const forProject = userConfig.projects?.[root]?.mcpServers;
  for (const name of serverNames({ mcpServers: forProject })) {
    found.push({ id: name, source: 'user' });
  }

  for (const file of ['settings.json', 'settings.local.json']) {
    const data = readJson<ClaudeSettings>(claudeHome(home, file));
    for (const name of serverNames({ mcpServers: data?.mcpServers })) {
      found.push({ id: name, source: 'user' });
    }
  }

  found.push(...pluginServers(home));
  found.push(...desktopPlugins(home));

  const seen = new Set<string>();
  return found.filter(({ id }) => !seen.has(id) && seen.add(id));
}

/**
 * Which roles a server id can serve, judged by the `server` names the project's
 * sources declare. One Atlassian server fronting both Jira and Confluence is not
 * a special case here — both skills simply list `atlassian`.
 */
export function classify(id: string, sources: readonly Routable[] = BUILTIN_SOURCES): string[] {
  const name = id.toLowerCase();
  const roles = new Set<string>();

  for (const source of sources) {
    if (source.server?.some((server) => name.includes(server.toLowerCase()))) roles.add(source.role);
  }

  return rolesOf(sources).filter((role) => roles.has(role));
}

/** role → server id, for whatever the detected servers can cover. */
export function mapRoles(servers: readonly Pick<Server, 'id'>[], sources: readonly Routable[] = BUILTIN_SOURCES): Mapping {
  const mapping: Mapping = {};

  for (const { id } of servers) {
    for (const role of classify(id, sources)) {
      if (!mapping[role]) mapping[role] = id;
    }
  }

  return mapping;
}

/** The `MCP roles` table. A role nobody reads says so instead of naming a server. */
export function rolesBlock(
  mapping: Mapping,
  roles: readonly string[] = BUILTIN_ROLES,
  linksOnly: ReadonlySet<string> = new Set(),
): string {
  const cell = (role: string) => {
    if (linksOnly.has(role)) return '— (links only)';
    const id = mapping[role];
    return id ? `\`${id}\`` : '— (not connected)';
  };
  const rows = roles.map((role) => `| ${role} | ${cell(role)} |`);
  return [ROLES_MARKER, '| Role | Server |', '| --- | --- |', ...rows].join('\n');
}

const BASE_TOOLS = ['Read', 'Grep', 'Glob', 'Write', 'Agent'];

/**
 * An agent's allowlist: the base tools, Agent to send its part-readers, and every
 * server that fills one of `roles`. Left out, `roles` means every role in the
 * mapping. The reader passes the roles somebody reads, so a role whose links are
 * only listed brings no server and no tool schemas to take up its context.
 */
export function toolsLine(mapping: Mapping, roles: Iterable<string> = Object.keys(mapping)): string {
  const wanted = new Set(roles);
  const reached = Object.entries(mapping).filter(([role, id]) => id && wanted.has(role));
  const ids = [...new Set(reached.map(([, id]) => id))];
  return `tools: ${[...BASE_TOOLS, ...ids.map((id) => `mcp__${id}`)].join(', ')}`;
}
