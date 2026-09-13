import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BUILTIN_ROLES, BUILTIN_SOURCES, CLAUDE_DIR, ROLES_MARKER } from '../constants.js';
import { rolesOf } from './sources.js';
import { readJson } from '../utils.js';

/** Where Claude Code keeps its own configuration, inside the user's home. */
const claudeHome = (home, ...parts) => path.join(home, CLAUDE_DIR, ...parts);

/**
 * Server maps come in two shapes: `{ mcpServers: {…} }` in Claude's own configs,
 * and a bare `{ name: {…} }` map in plugin .mcp.json files.
 */
function serverNames(data) {
  if (!data || typeof data !== 'object') return [];
  const map = data.mcpServers && typeof data.mcpServers === 'object' ? data.mcpServers : data;
  // A declared server with an empty url is a placeholder, not something to reach.
  return Object.keys(map).filter((key) => map[key] && typeof map[key] === 'object' && map[key].url !== '');
}

function pluginServers(home) {
  // Both files, for the same reason detectServers reads both: a plugin turned on
  // for this machine alone lands in the local one.
  const enabledIn = (file) => Object.entries(readJson(claudeHome(home, file))?.enabledPlugins ?? {});
  const enabled = [...enabledIn('settings.json'), ...enabledIn('settings.local.json')]
    .filter(([, on]) => on)
    .map(([key]) => key.split('@')[0]);

  const marketplaces = claudeHome(home, 'plugins', 'marketplaces');
  const found = [];

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
function subdirs(dir) {
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
function desktopRoots(home) {
  const tail = ['Claude', 'local-agent-mode-sessions'];
  return [
    path.join(home, 'Library', 'Application Support', ...tail),
    path.join(home, 'AppData', 'Roaming', ...tail),
    path.join(home, '.config', ...tail),
  ];
}

/**
 * Servers from plugins installed through the desktop app, which keeps them
 * outside `~/.claude` — under `<root>/<session>/<run>/rpm`, where `manifest.json`
 * names each plugin and `plugin_<id>/.mcp.json` lists its servers. Ids come out
 * in the same `plugin:<plugin>:<server>` shape the CLI uses.
 */
function desktopPlugins(home) {
  const found = [];

  for (const root of desktopRoots(home)) {
    for (const session of subdirs(root)) {
      for (const run of subdirs(session)) {
        const rpm = path.join(run, 'rpm');
        const manifest = readJson(path.join(rpm, 'manifest.json'));

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
export function detectServers(root, { home = os.homedir() } = {}) {
  const found = [];

  for (const name of serverNames(readJson(path.join(root, '.mcp.json')))) {
    found.push({ id: name, source: 'project' });
  }

  const userConfig = readJson(path.join(home, '.claude.json')) ?? {};
  for (const name of serverNames({ mcpServers: userConfig.mcpServers })) {
    found.push({ id: name, source: 'user' });
  }
  const forProject = userConfig.projects?.[root]?.mcpServers;
  for (const name of serverNames({ mcpServers: forProject })) {
    found.push({ id: name, source: 'user' });
  }

  for (const file of ['settings.json', 'settings.local.json']) {
    const data = readJson(claudeHome(home, file));
    for (const name of serverNames({ mcpServers: data?.mcpServers })) {
      found.push({ id: name, source: 'user' });
    }
  }

  found.push(...pluginServers(home));
  found.push(...desktopPlugins(home));

  const seen = new Set();
  return found.filter(({ id }) => !seen.has(id) && seen.add(id));
}

/**
 * Which roles a server id can serve, judged by the `server` names the project's
 * sources declare. One Atlassian server fronting both Jira and Confluence is not
 * a special case here — both skills simply list `atlassian`.
 */
export function classify(id, sources = BUILTIN_SOURCES) {
  const name = id.toLowerCase();
  const roles = new Set();

  for (const source of sources) {
    if (source.server?.some((server) => name.includes(server.toLowerCase()))) roles.add(source.role);
  }

  return rolesOf(sources).filter((role) => roles.has(role));
}

/** role → server id, for whatever the detected servers can cover. */
export function mapRoles(servers, sources = BUILTIN_SOURCES) {
  const mapping = {};

  for (const { id } of servers) {
    for (const role of classify(id, sources)) {
      if (!mapping[role]) mapping[role] = id;
    }
  }

  return mapping;
}

export function rolesBlock(mapping, roles = BUILTIN_ROLES) {
  const rows = roles.map((role) => `| ${role} | ${mapping[role] ? `\`${mapping[role]}\`` : '— (not connected)'} |`);
  return [ROLES_MARKER, '| Role | Server |', '| --- | --- |', ...rows].join('\n');
}

const BASE_TOOLS = ['Read', 'Grep', 'Glob', 'Write'];

/** The specificator's allowlist: our four tools plus every server a role maps to. */
export function toolsLine(mapping) {
  const ids = [...new Set(Object.values(mapping).filter(Boolean))];
  return `tools: ${[...BASE_TOOLS, ...ids.map((id) => `mcp__${id}`)].join(', ')}`;
}
