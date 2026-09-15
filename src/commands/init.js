import fs from 'node:fs';
import path from 'node:path';

import { cyan, dim } from '../platform/color.js';
import { printClaudeHint, printConnectHint } from './connect.js';
import {
  AGENTIC_DIR,
  AGENTS_FILE,
  CLAUDE_DIR,
  CLAUDE_FILE,
  GITIGNORE_FILE,
  LANGUAGE_MARKER,
  ROLES_MARKER,
  MCP_AGENT_PATHS,
} from '../constants.js';
import {
  copyTree,
  createReporter,
  ensureDir,
  ensureSymlink,
  inside,
  removeIfEmpty,
  removePath,
  statOrNull,
  writeIfMissing,
  writeManaged,
} from '../platform/fsx.js';
import {
  DEFAULT_LANGUAGE,
  applyBlock,
  applyDocLanguage,
  languageBlock,
  parseLang,
} from '../model/docs.js';
import { classify, detectServers, mapRoles, rolesBlock, toolsLine } from '../model/mcp.js';
import { readSources, rolesOf } from '../model/sources.js';
import { createManifest, readManifest } from '../model/manifest.js';
import { findProjectRoot, ownPackage, projectName } from '../project.js';
import { TEMPLATES_DIR, fill, hash, readTemplate } from '../utils.js';

const SUBDIRS = [
  ['skills', 'skills.README.md'],
  ['agents', 'agents.README.md'],
  ['hooks', 'hooks.README.md'],
  ['tasks', 'tasks.README.md'],
];

/** Warns when .gitignore would keep the .claude symlink out of the repository. */
function checkGitignore(root, reporter) {
  const gitignore = path.join(root, GITIGNORE_FILE);
  if (!fs.existsSync(gitignore)) return;

  const ignored = fs
    .readFileSync(gitignore, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .some((line) => [CLAUDE_DIR, `${CLAUDE_DIR}/`, `/${CLAUDE_DIR}`, `/${CLAUDE_DIR}/`].includes(line));

  if (ignored) {
    reporter.warn(
      `${GITIGNORE_FILE} ignores ${CLAUDE_DIR}, so the symlink will not be committed`,
      'drop that line — the symlink is meant to be shared with the repository',
    );
  }
}

/**
 * Keeps the allowlist of every agent that talks to MCP in step with the servers
 * that actually exist. Same rule as everywhere else: rewrite only what we wrote
 * and nobody edited.
 */
export function applyToolsLine(root, mapping, { dryRun, reporter }, manifest) {
  const line = toolsLine(mapping);
  const recorded = readManifest(root)?.entries ?? [];

  for (const agent of MCP_AGENT_PATHS) {
    const file = path.join(root, agent);
    const stat = statOrNull(file);
    if (!stat?.isFile()) continue;

    const raw = fs.readFileSync(file, 'utf8');
    const updated = raw.replace(/^tools:.*$/m, line);
    if (updated === raw) continue;

    const knownHash = recorded.find((e) => e.path === agent)?.hash;
    if (knownHash && hash(raw) !== knownHash) {
      reporter.warn(
        `${agent} was edited by hand — left untouched`,
        `set its allowlist yourself:  ${line}`,
      );
      continue;
    }

    if (!dryRun) fs.writeFileSync(file, updated);
    manifest.addFile(file, updated);
    reporter.updated(`${agent}: tools`);
  }
}

function scaffold(root, opts, manifest, language, mapping, roles, seen) {
  const { reporter } = opts;

  // Two different questions. `seen` is every file this version of the package
  // has an opinion about, written or not — anything in the manifest and not in
  // here was dropped from the package. The manifest records only what we wrote.
  const onFile = (file, content, what) => {
    seen.add(path.relative(root, file));
    if (what === 'created' || what === 'updated') manifest.addFile(file, content);
  };

  // What each file looked like when we last wrote it. Anything still identical
  // to that is ours to bring up to date; everything else stays as it is.
  const recorded = readManifest(root)?.entries ?? [];
  const knownHash = (file) => recorded.find((e) => e.path === path.relative(root, file))?.hash;

  // Everything else lives under it, so there is nothing to try if it is blocked.
  // ensureDir has already said what is wrong and how to fix it.
  const agenticDir = path.join(root, AGENTIC_DIR);
  const madeAgentic = ensureDir(agenticDir, { ...opts, label: `${AGENTIC_DIR}/` });
  if (madeAgentic === 'blocked') return false;
  if (madeAgentic === 'created') manifest.addDir(agenticDir);

  for (const [dir, readme] of SUBDIRS) {
    const target = path.join(root, AGENTIC_DIR, dir);
    const label = `${AGENTIC_DIR}/${dir}`;

    if (ensureDir(target, { ...opts, label: `${label}/` }) === 'blocked') continue;
    manifest.addDir(target);

    const keep = path.join(target, '.gitkeep');
    const madeKeep = writeIfMissing(keep, '', { ...opts, label: `${label}/.gitkeep` });
    onFile(keep, '', madeKeep ? 'created' : 'skipped');

    if (readme) {
      const file = path.join(target, 'README.md');
      const body = readTemplate(readme);
      onFile(file, body, writeManaged(file, body, { ...opts, label: `${label}/README.md`, knownHash: knownHash(file) }));
    }
  }

  // Agents and skills that make the task pipeline work.
  copyTree(path.join(TEMPLATES_DIR, 'seed'), path.join(root, AGENTIC_DIR), {
    ...opts,
    label: AGENTIC_DIR,
    onFile,
    onDir: (dir) => manifest.addDir(dir),
    transform: (content) => fill(content, { MCP_TOOLS: toolsLine(mapping) }),
    knownHash,
  });

  const agents = path.join(root, AGENTS_FILE);
  const agentsBody = readTemplate(AGENTS_FILE)
    .replace('{{PROJECT_NAME}}', () => projectName(root, path.join(root, 'package.json')))
    .replace(`${LANGUAGE_MARKER}\n{{DOC_LANGUAGE}}`, () => languageBlock(language ?? DEFAULT_LANGUAGE))
    .replace(`${ROLES_MARKER}\n{{MCP_ROLES}}`, () => rolesBlock(mapping, roles));
  if (writeIfMissing(agents, agentsBody, { ...opts, label: AGENTS_FILE })) {
    onFile(agents, agentsBody, 'created');
  } else {
    onFile(agents, agentsBody, 'skipped');
    // The file is the user's — patch the marked blocks, never the whole file.
    // The language is a choice already made: only --lang changes it.
    if (language) applyDocLanguage(root, language, opts);
    applyBlock(root, ROLES_MARKER, rolesBlock(mapping, roles), { ...opts, label: 'MCP roles' });
  }

  applyToolsLine(root, mapping, opts, manifest);

  const claudeMd = path.join(root, CLAUDE_FILE);
  if (ensureSymlink(claudeMd, AGENTS_FILE, { ...opts, type: 'file', label: CLAUDE_FILE })) {
    manifest.addLink(claudeMd, AGENTS_FILE);
  }

  const claudeDir = path.join(root, CLAUDE_DIR);
  if (ensureSymlink(claudeDir, AGENTIC_DIR, { ...opts, type: 'dir', label: CLAUDE_DIR })) {
    manifest.addLink(claudeDir, AGENTIC_DIR);
  }

  checkGitignore(root, reporter);
  return true;
}

/**
 * Removes what an older version of the package wrote and this one no longer
 * ships — a renamed skill would otherwise stay in the project for good, and
 * Claude Code would keep loading it beside the one that replaced it.
 *
 * Same rule as writing: a file still identical to its hash in the manifest is
 * ours to remove, anything the user touched is theirs to keep.
 */
function prune(root, manifest, recorded, seen, { dryRun, reporter }) {
  // An empty `seen` means the scaffold produced nothing, not that the package
  // ships nothing. Deleting the whole manifest on the strength of that would be
  // the worst thing this tool could do.
  if (!seen.size) return;

  const dirs = new Set();

  for (const entry of recorded) {
    if (entry.type !== 'file' || seen.has(entry.path)) continue;

    const target = path.join(root, entry.path);
    if (!inside(root, target)) continue;

    const stat = statOrNull(target);
    if (!stat) {
      manifest.remove(entry.path); // already gone — nothing to say
      continue;
    }

    // Something else stands there now. Reading it would throw, and deleting it
    // could take a directory of the user's files with it.
    if (!stat.isFile()) {
      reporter.warn(
        `${entry.path} is no longer a regular file — left untouched`,
        'the package stopped shipping it; remove it yourself if you want it gone',
      );
      continue;
    }

    // No hash, or one that no longer matches: we cannot prove the file is ours
    // and unedited, so it stays. Only the edited case is worth a word.
    if (hash(fs.readFileSync(target, 'utf8')) !== entry.hash) {
      if (entry.hash) {
        reporter.warn(
          `${entry.path} was edited, and the package no longer ships it — left as it is`,
          'delete it yourself once you no longer need it',
        );
      }
      continue;
    }

    if (!dryRun) removePath(target);
    manifest.remove(entry.path);
    dirs.add(path.dirname(target));
    reporter.removed(entry.path);
  }

  // A retired skill leaves its directory behind. Deepest first, and only ever
  // one that holds nothing — a directory with the user's files in it stays.
  if (dryRun) return;
  for (const dir of [...dirs].sort((a, b) => b.length - a.length)) {
    if (!inside(root, dir) || !removeIfEmpty(dir)) continue;
    const rel = path.relative(root, dir);
    manifest.remove(rel); // or it would be recorded for a directory that is gone
    reporter.removed(`${rel}/`);
  }
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
  const link = path.join(root, CLAUDE_DIR);
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

  // Read before scaffold touches anything: this is the state the last run left.
  const previous = readManifest(root);
  const manifest = createManifest(root);
  const sources = readSources(root, { reporter });
  const language = parseLang(lang, reporter);

  const running = ownPackage().version;
  if (previous?.packageVersion && previous.packageVersion !== running) {
    reporter.info(`upgrading ${previous.packageVersion} ${dim('->')} ${cyan(running)}`);
  }

  // Nothing is asked for: what is connected, we find; what is not, we explain.
  const { mapping, roles } = detect(root, sources, reporter);

  const seen = new Set();
  if (scaffold(root, opts, manifest, language, mapping, roles, seen)) {
    prune(root, manifest, previous?.entries ?? [], seen, opts);
    manifest.write({ dryRun, version: running });
  }

  printConnectHint(sources, mapping, reporter);

  const { created, updated, removed, skipped, warnings } = reporter.counts;
  const did = (count, verb) => `${count} ${dryRun ? `would be ${verb}` : verb}`;
  console.log('');
  reporter.info(
    `${dryRun ? 'dry run — ' : ''}${did(created, 'created')}, ` +
      (updated ? `${did(updated, 'updated')}, ` : '') +
      (removed ? `${did(removed, 'removed')}, ` : '') +
      `${skipped} unchanged, ${warnings} warning${warnings === 1 ? '' : 's'}`,
  );
  if (created > 0 && !dryRun) {
    reporter.info('next:');
    console.log(`    ${dim('1.')} describe the project in AGENTS.md — Overview, Commands, Conventions`);
    console.log(`    ${dim('2.')} ${cyan('npx @rudevich/agentic-flow config')} — re-scan once your MCP servers are connected`);
    console.log(`    ${dim('3.')} ${cyan('/spec <ticket-url>')} — specify your first task`);
  } else if ((updated > 0 || removed > 0) && !dryRun) {
    // An upgrade creates nothing. The new files still do nothing until the
    // session that reads them starts again.
    reporter.info('next:');
    console.log(`    ${dim('1.')} restart your Claude session — skills and agents are read when it starts`);
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
