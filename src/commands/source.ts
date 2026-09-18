import path from 'node:path';

import { cyan } from '../platform/color.ts';
import { printConnectHint } from './connect.ts';
import { ROLES_MARKER, SKILLS_DIR } from '../constants.ts';
import { applyBlock } from '../model/docs.ts';
import { createReporter, ensureDir, statOrNull, writeIfMissing, type Counts, type Reporter } from '../platform/fsx.ts';
import { applyToolsLine } from './init.ts';
import { createManifest } from '../model/manifest.ts';
import { classify, detectServers, mapRoles, rolesBlock } from '../model/mcp.ts';
import { createPrompt, interactive } from '../platform/prompt.ts';
import { findProjectRoot } from '../project.ts';
import { linksOnlyRoles, readSources, rolesOf, type Source } from '../model/sources.ts';
import { fill, readTemplate } from '../utils.ts';

/** A source's declaration as flags and answers give it: every field one plain string. */
interface Fields {
  role: string;
  matches: string;
  writes: string;
  server: string;
  auth: string;
  links: string;
}

export interface AddSourceOptions extends Partial<Fields> {
  cwd?: string;
  name?: string;
  dryRun?: boolean;
}

const NAME_RE = /^[a-z][a-z0-9-]*$/;

const title = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const render = (fields: Record<string, string>) => fill(readTemplate('source.SKILL.md'), fields);

/** Fills in what the flags did not say, asking only when someone can answer. */
async function complete(name: string, given: Partial<Fields>, reporter: Reporter): Promise<Fields | null> {
  const writes = given.writes ?? `sources/${name}`;
  const server = given.server ?? name;
  const links = given.links ?? 'follow';

  if (!interactive()) {
    if (!given.matches) {
      reporter.warn(
        'no TTY and no --matches — cannot tell which URLs this source reads',
        `agentic-flow source add ${name} --role docs --matches example.com`,
      );
      return null;
    }
    return { role: given.role ?? 'docs', matches: given.matches, writes, server, auth: given.auth ?? 'token', links };
  }

  const prompt = createPrompt();
  try {
    console.log('');
    reporter.info(`a new source: ${SKILLS_DIR}/${name}/`);

    // One question at a time, in this order, and none whose flag was given.
    const role = given.role ?? ((await prompt.ask('  role it fills [docs]:')).trim() || 'docs');
    let matches = given.matches ?? '';
    while (!matches) {
      matches = (await prompt.ask('  URL fragments that identify it, comma-separated:')).trim();
    }
    const snapshots = (await prompt.ask(`  snapshot directory [${writes}]:`)).trim() || writes;
    const serverName = (await prompt.ask(`  MCP server name [${server}]:`)).trim() || server;
    const auth =
      given.auth ??
      ((await prompt.ask('  does its MCP server need an API token? [Y/n]')).trim().toLowerCase() === 'n' ? 'none' : 'token');

    return { role, matches, writes: snapshots, server: serverName, auth, links };
  } finally {
    prompt.close();
  }
}

/**
 * Creates one source skill. The skill file itself is the user's content and
 * stays out of the manifest — `reset` must never take it back. What we do
 * record is what we touched on their behalf: .mcp.json, the example, .gitignore.
 */
export async function addSource({ cwd = process.cwd(), name, dryRun = false, ...given }: AddSourceOptions = {}): Promise<Counts> {
  const reporter = createReporter({ dryRun });
  const opts = { dryRun, force: false, reporter };

  if (!name || !NAME_RE.test(name)) {
    reporter.warn(`"${name ?? ''}" is not a source name`, 'lowercase letters, digits and dashes, starting with a letter');
    return reporter.counts;
  }

  const found = findProjectRoot(cwd);
  const root = found ? found.root : path.resolve(cwd);
  const dir = path.join(root, SKILLS_DIR, name);

  if (statOrNull(dir)) {
    reporter.warn(`${SKILLS_DIR}/${name} already exists — left untouched`, 'pick another name, or edit that skill');
    return reporter.counts;
  }

  const fields = await complete(name, given, reporter);
  if (!fields) return reporter.counts;

  const manifest = createManifest(root);

  if (ensureDir(dir, { ...opts, label: `${SKILLS_DIR}/${name}/` }) === 'blocked') return reporter.counts;
  const body = render({ NAME: name, TITLE: title(name), ROLE: fields.role, MATCHES: fields.matches, WRITES: fields.writes, SERVER: fields.server, AUTH: fields.auth, LINKS: fields.links });
  writeIfMissing(path.join(dir, 'SKILL.md'), body, { ...opts, label: `${SKILLS_DIR}/${name}/SKILL.md` });

  // The roles table and the reader's allowlist follow from the declarations.
  const sources: Source[] = dryRun
    ? [
        ...readSources(root, { reporter }),
        {
          name,
          ...fields,
          matches: fields.matches.split(',').map((m) => m.trim()),
          server: [fields.server],
          fetch: 'yes',
        },
      ]
    : readSources(root, { reporter });
  const mapping = mapRoles(detectServers(root).filter(({ id }) => classify(id, sources).length), sources);

  const linksOnly = linksOnlyRoles(sources);
  applyBlock(root, ROLES_MARKER, rolesBlock(mapping, rolesOf(sources), linksOnly), { ...opts, label: 'MCP roles' });
  applyToolsLine(root, mapping, linksOnly, opts, manifest);
  if (manifest.size()) manifest.write({ dryRun });

  // Only about this source: the other roles are init's business, not this one's.
  printConnectHint(sources.filter((source) => source.name === name), mapping, reporter);

  console.log('');
  reporter.info(`fill in the TODOs in ${cyan(`${SKILLS_DIR}/${name}/SKILL.md`)} — what it reads, and which links it hands back`);

  return reporter.counts;
}
