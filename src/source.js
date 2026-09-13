import fs from 'node:fs';
import path from 'node:path';

import { cyan } from './color.js';
import { printConnectHint } from './connect.js';
import { applyBlock } from './docs.js';
import { createReporter, ensureDir, statOrNull, writeIfMissing } from './fsx.js';
import { applyToolsLine } from './init.js';
import { createManifest } from './manifest.js';
import { ROLES_MARKER, classify, detectServers, mapRoles, rolesBlock } from './mcp.js';
import { createPrompt, interactive } from './prompt.js';
import { findProjectRoot, packageRoot } from './project.js';
import { SKILLS_DIR, readSources, rolesOf } from './sources.js';

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const TEMPLATE = path.join(packageRoot, 'src', 'templates', 'source.SKILL.md');

const title = (name) => name.charAt(0).toUpperCase() + name.slice(1);

function render(fields) {
  const raw = fs.readFileSync(TEMPLATE, 'utf8');
  return Object.entries(fields).reduce(
    (body, [key, value]) => body.replaceAll(`{{${key}}}`, value),
    raw,
  );
}

/** Fills in what the flags did not say, asking only when someone can answer. */
async function complete(name, given, reporter) {
  const fields = {
    role: given.role,
    matches: given.matches,
    writes: given.writes ?? `sources/${name}.md`,
    server: given.server ?? name,
    auth: given.auth,
    links: given.links ?? 'follow',
  };

  if (!interactive()) {
    if (!fields.matches) {
      reporter.warn(
        'no TTY and no --matches — cannot tell which URLs this source reads',
        `agentic-flow source add ${name} --role docs --matches example.com`,
      );
      return null;
    }
    return { ...fields, role: fields.role ?? 'docs', auth: fields.auth ?? 'token' };
  }

  const prompt = createPrompt();
  try {
    console.log('');
    reporter.info(`a new source: agentic/${SKILLS_DIR}/${name}/`);

    fields.role ??= (await prompt.ask('  role it fills [docs]:')).trim() || 'docs';
    while (!fields.matches) {
      fields.matches = (await prompt.ask('  URL fragments that identify it, comma-separated:')).trim();
    }
    fields.writes = (await prompt.ask(`  snapshot file [${fields.writes}]:`)).trim() || fields.writes;
    fields.server = (await prompt.ask(`  MCP server name [${fields.server}]:`)).trim() || fields.server;
    fields.auth ??= (await prompt.ask('  does its MCP server need an API token? [Y/n]')).trim().toLowerCase() === 'n' ? 'none' : 'token';
  } finally {
    prompt.close();
  }

  return fields;
}

/**
 * Creates one source skill. The skill file itself is the user's content and
 * stays out of the manifest — `reset` must never take it back. What we do
 * record is what we touched on their behalf: .mcp.json, the example, .gitignore.
 */
export async function addSource({ cwd = process.cwd(), name, dryRun = false, ...given } = {}) {
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

  // The roles table and the specificator's allowlist follow from the declarations.
  const sources = dryRun
    ? [
        ...readSources(root, { reporter }),
        {
          name,
          ...fields,
          matches: fields.matches.split(',').map((m) => m.trim()),
          server: [fields.server],
        },
      ]
    : readSources(root, { reporter });
  const mapping = mapRoles(detectServers(root).filter(({ id }) => classify(id, sources).length), sources);

  applyBlock(root, ROLES_MARKER, rolesBlock(mapping, rolesOf(sources)), { ...opts, label: 'MCP roles' });
  applyToolsLine(root, mapping, opts, manifest);
  if (manifest.size()) manifest.write({ dryRun });

  // Only about this source: the other roles are init's business, not this one's.
  printConnectHint(sources.filter((source) => source.name === name), mapping, reporter);

  console.log('');
  reporter.info(`fill in the TODOs in ${cyan(`${SKILLS_DIR}/${name}/SKILL.md`)} — what it reads, and which links it hands back`);

  return reporter.counts;
}
