import fs from 'node:fs';
import path from 'node:path';

import { cyan, dim } from './color.js';
import { printClaudeHint, printConnectHint } from './connect.js';
import {
  copyTree,
  createReporter,
  ensureDir,
  ensureSymlink,
  statOrNull,
  writeIfMissing,
  writeManaged,
} from './fsx.js';
import {
  DEFAULT_LANGUAGE,
  MARKER,
  applyBlock,
  applyDocLanguage,
  languageBlock,
  parseLang,
} from './docs.js';
import {
  ROLES_MARKER,
  classify,
  detectServers,
  mapRoles,
  rolesBlock,
  toolsLine,
} from './mcp.js';
import { readSources, rolesOf } from './sources.js';
import { createManifest, hash, readManifest } from './manifest.js';
import { findProjectRoot, packageRoot, projectName } from './project.js';

const AGENTIC_DIR = 'agentic';
const SUBDIRS = [
  ['skills', 'skills.README.md'],
  ['agents', 'agents.README.md'],
  ['hooks', 'hooks.README.md'],
  ['tasks', 'tasks.README.md'],
];

function template(name) {
  return fs.readFileSync(path.join(packageRoot, 'src', 'templates', name), 'utf8');
}

/** Warns when .gitignore would keep the .claude symlink out of the repository. */
function checkGitignore(root, reporter) {
  const gitignore = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignore)) return;

  const ignored = fs
    .readFileSync(gitignore, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .some((line) => ['.claude', '.claude/', '/.claude', '/.claude/'].includes(line));

  if (ignored) {
    reporter.warn(
      '.gitignore ignores .claude, so the symlink will not be committed',
      'drop that line — the symlink is meant to be shared with the repository',
    );
  }
}

const SPECIFICATOR = path.join(AGENTIC_DIR, 'agents', 'specificator.md');

/**
 * Keeps the specificator's allowlist in step with the servers that actually
 * exist. Same rule as .mcp.json: rewrite only what we wrote and nobody edited.
 */
export function applyToolsLine(root, mapping, { dryRun, reporter }, manifest) {
  const file = path.join(root, SPECIFICATOR);
  const stat = statOrNull(file);
  if (!stat) return;

  const raw = fs.readFileSync(file, 'utf8');
  const line = toolsLine(mapping);
  const updated = raw.replace(/^tools:.*$/m, line);

  if (updated === raw) return;

  const knownHash = readManifest(root)?.entries.find((e) => e.path === SPECIFICATOR)?.hash;
  if (knownHash && hash(raw) !== knownHash) {
    reporter.warn(
      `${SPECIFICATOR} was edited by hand — left untouched`,
      `set its allowlist yourself:  ${line}`,
    );
    return;
  }

  if (!dryRun) fs.writeFileSync(file, updated);
  manifest.addFile(file, updated);
  reporter.created(`${SPECIFICATOR}: tools`);
}

function scaffold(root, opts, manifest, language, mapping, roles) {
  const { reporter } = opts;
  const onFile = (file, content) => manifest.addFile(file, content);

  // What each file looked like when we last wrote it. Anything still identical
  // to that is ours to bring up to date; everything else stays as it is.
  const recorded = readManifest(root)?.entries ?? [];
  const knownHash = (file) => recorded.find((e) => e.path === path.relative(root, file))?.hash;

  if (ensureDir(path.join(root, AGENTIC_DIR), { ...opts, label: `${AGENTIC_DIR}/` }) === 'created') {
    manifest.addDir(path.join(root, AGENTIC_DIR));
  }

  for (const [dir, readme] of SUBDIRS) {
    const target = path.join(root, AGENTIC_DIR, dir);
    const label = `${AGENTIC_DIR}/${dir}`;

    if (ensureDir(target, { ...opts, label: `${label}/` }) === 'blocked') continue;
    manifest.addDir(target);

    const keep = path.join(target, '.gitkeep');
    if (writeIfMissing(keep, '', { ...opts, label: `${label}/.gitkeep` })) manifest.addFile(keep, '');

    if (readme) {
      const file = path.join(target, 'README.md');
      const body = template(readme);
      const what = writeManaged(file, body, { ...opts, label: `${label}/README.md`, knownHash: knownHash(file) });
      if (what === 'created' || what === 'updated') manifest.addFile(file, body);
    }
  }

  // Agents and skills that make the task pipeline work.
  copyTree(path.join(packageRoot, 'src', 'templates', 'seed'), path.join(root, AGENTIC_DIR), {
    ...opts,
    label: AGENTIC_DIR,
    onFile,
    onDir: (dir) => manifest.addDir(dir),
    transform: (content) => content.replace('{{MCP_TOOLS}}', toolsLine(mapping)),
    knownHash,
  });

  const agents = path.join(root, 'AGENTS.md');
  const agentsBody = template('AGENTS.md')
    .replace('{{PROJECT_NAME}}', projectName(root, path.join(root, 'package.json')))
    .replace(`${MARKER}\n{{DOC_LANGUAGE}}`, languageBlock(language ?? DEFAULT_LANGUAGE))
    .replace(`${ROLES_MARKER}\n{{MCP_ROLES}}`, rolesBlock(mapping, roles));
  if (writeIfMissing(agents, agentsBody, { ...opts, label: 'AGENTS.md' })) {
    manifest.addFile(agents, agentsBody);
  } else {
    // The file is the user's — patch the marked blocks, never the whole file.
    // The language is a choice already made: only --lang changes it.
    if (language) applyDocLanguage(root, language, opts);
    applyBlock(root, ROLES_MARKER, rolesBlock(mapping, roles), { ...opts, label: 'MCP roles' });
  }

  applyToolsLine(root, mapping, opts, manifest);

  const claudeMd = path.join(root, 'CLAUDE.md');
  if (ensureSymlink(claudeMd, 'AGENTS.md', { ...opts, type: 'file', label: 'CLAUDE.md' })) {
    manifest.addLink(claudeMd, 'AGENTS.md');
  }

  const claudeDir = path.join(root, '.claude');
  if (ensureSymlink(claudeDir, AGENTIC_DIR, { ...opts, type: 'dir', label: '.claude' })) {
    manifest.addLink(claudeDir, AGENTIC_DIR);
  }

  checkGitignore(root, reporter);
}

/** Prints what was detected and which role each server can fill. */
function reportDetected(servers, mapping, reporter, allRoles) {
  reporter.info('found MCP servers:');
  for (const { id, source } of servers) {
    const roles = allRoles.filter((role) => mapping[role] === id);
    if (!roles.length) continue;
    console.log(`    ${cyan(id)}  ${dim(`(${source})`)}  -> ${roles.join(', ')}`);
  }
}

/**
 * `.claude` must resolve to `agentic/` or none of this is visible to Claude Code.
 * Returns what is in the way, or null. Looks at what is on disk, so it answers
 * the same during a dry run.
 */
function claudeConflict(root) {
  const link = path.join(root, '.claude');
  const stat = statOrNull(link);
  if (!stat) return null;

  if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(link);
    const ours = path.resolve(root, target) === path.resolve(root, AGENTIC_DIR);
    return ours ? null : { status: 'symlink', target };
  }

  return { status: stat.isDirectory() ? 'dir' : 'file' };
}

/** Ties the servers this project can already see to the roles its sources need. */
function detect(root, sources, reporter) {
  const roles = rolesOf(sources);
  const detected = detectServers(root).filter(({ id }) => classify(id, sources).length);
  const mapping = mapRoles(detected, sources);

  if (detected.length) {
    console.log('');
    reportDetected(detected, mapping, reporter, roles);
  }

  return { mapping, roles };
}

export async function init({ cwd = process.cwd(), dryRun = false, force = false, lang } = {}) {
  const reporter = createReporter({ dryRun });
  const opts = { dryRun, force, reporter };

  const found = findProjectRoot(cwd);
  const root = found ? found.root : path.resolve(cwd);
  if (!found) reporter.warn(`no package.json at or above ${root}`, 'scaffolding there anyway');

  reporter.info(`project root: ${root}`);

  const manifest = createManifest(root);
  const sources = readSources(root, { reporter });
  const language = parseLang(lang, reporter);

  // Nothing is asked for: what is connected, we find; what is not, we explain.
  const { mapping, roles } = detect(root, sources, reporter);

  scaffold(root, opts, manifest, language, mapping, roles);
  manifest.write({ dryRun });

  printConnectHint(sources, mapping, reporter);

  const { created, updated, skipped, warnings } = reporter.counts;
  console.log('');
  reporter.info(
    `${dryRun ? `dry run — ${created} would be created` : `${created} created`}, ` +
      (updated ? `${updated} updated, ` : '') +
      `${skipped} unchanged, ${warnings} warning${warnings === 1 ? '' : 's'}`,
  );
  if (created > 0 && !dryRun) {
    reporter.info('next:');
    console.log(`    ${dim('1.')} describe the project in AGENTS.md — Overview, Commands, Conventions`);
    console.log(`    ${dim('2.')} ${cyan('npx agentic-flow config')} — re-scan once your MCP servers are connected`);
    console.log(`    ${dim('3.')} ${cyan('/spec <ticket-url>')} — specify your first task`);
  }

  // Last, and whatever the counts say: on a second run nothing is created, but
  // the thing that stops /spec from existing is still there.
  printClaudeHint(claudeConflict(root), reporter);

  return reporter.counts;
}

/** Looks again at what is connected, and rebuilds what follows from it. */
export async function config({ cwd = process.cwd(), dryRun = false, lang } = {}) {
  const reporter = createReporter({ dryRun });
  const opts = { dryRun, force: false, reporter };

  const found = findProjectRoot(cwd);
  const root = found ? found.root : path.resolve(cwd);
  const manifest = createManifest(root);
  const sources = readSources(root, { reporter });
  const language = parseLang(lang, reporter);

  const { mapping, roles } = detect(root, sources, reporter);

  if (language) applyDocLanguage(root, language, opts);
  applyBlock(root, ROLES_MARKER, rolesBlock(mapping, roles), { ...opts, label: 'MCP roles' });
  applyToolsLine(root, mapping, opts, manifest);
  manifest.write({ dryRun });

  printConnectHint(sources, mapping, reporter);

  return reporter.counts;
}
