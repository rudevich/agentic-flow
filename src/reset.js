import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { cyan, dim, red } from './color.js';
import { AGENTIC_DIR, ENV_FILE, GITIGNORE_FILE, MANIFEST_PATH } from './constants.js';
import { createReporter, inside, removeIfEmpty, removePath, statOrNull } from './fsx.js';
import { readManifest } from './manifest.js';
import { createPrompt, interactive } from './prompt.js';
import { findProjectRoot } from './project.js';
import { hash } from './utils.js';

/** Untracked or uncommitted content is unrecoverable once deleted. */
function dirtyPaths(root, paths) {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '-uall', '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3))
      .map((p) => (p.includes(' -> ') ? p.split(' -> ')[1] : p));
  } catch {
    return []; // not a git repo, or git unavailable
  }
}

/**
 * Decides what reset would remove. Only manifest entries are ever candidates —
 * files the user wrote are invisible to this.
 */
function plan(root, manifest, { force, secrets, all }) {
  const remove = [];
  const kept = [];

  for (const entry of manifest.entries) {
    if (entry.type === 'gitignore-line') {
      remove.push(entry);
      continue;
    }

    // Directories are never removed here — a recursive delete would take the
    // user's own files with it. They are pruned at the end, only if empty.
    if (entry.type === 'dir') continue;

    const target = path.join(root, entry.path);
    if (!inside(root, target)) continue;

    const stat = statOrNull(target);
    if (!stat) continue;

    if (entry.type === 'file' && entry.hash && !force) {
      if (!stat.isFile() || hash(fs.readFileSync(target, 'utf8')) !== entry.hash) {
        kept.push({ ...entry, reason: 'modified' });
        continue;
      }
    }

    // A symlink the user repointed is as much their change as an edited file.
    if (entry.type === 'symlink' && entry.target && !force) {
      const current = stat.isSymbolicLink() ? fs.readlinkSync(target) : null;
      if (current !== entry.target) {
        kept.push({ ...entry, reason: 'repointed' });
        continue;
      }
    }

    remove.push(entry);
  }

  if (all) remove.push({ path: AGENTIC_DIR, type: 'tree' });
  if (secrets) remove.push({ path: ENV_FILE, type: 'file' });

  return { remove, kept };
}

function dropGitignoreLine(root, line, dryRun) {
  const file = path.join(root, GITIGNORE_FILE);
  if (!statOrNull(file)) return false;

  const raw = fs.readFileSync(file, 'utf8');
  const kept = raw.split('\n').filter((l) => l.trim() !== line);
  if (kept.length === raw.split('\n').length) return false;

  if (!dryRun) fs.writeFileSync(file, kept.join('\n'));
  return true;
}

export async function reset({
  cwd = process.cwd(),
  dryRun = false,
  yes = false,
  force = false,
  secrets = false,
  all = false,
} = {}) {
  const reporter = createReporter({ dryRun });

  const found = findProjectRoot(cwd);
  const root = found ? found.root : path.resolve(cwd);

  const manifest = readManifest(root);
  if (!manifest) {
    reporter.info(`no ${MANIFEST_PATH} — nothing to reset`);
    return { removed: 0, kept: 0 };
  }

  const { remove, kept } = plan(root, manifest, { force, secrets, all });

  if (!remove.length) {
    reporter.info('nothing left to remove');
    for (const entry of kept) reporter.skipped(entry.path, entry.reason);
    return { removed: 0, kept: kept.length };
  }

  console.log('');
  reporter.info(`${dryRun ? 'would remove' : 'about to remove'} ${remove.length} path(s) in ${root}:`);
  for (const entry of remove) {
    console.log(`    ${red(entry.type === 'gitignore-line' ? `.gitignore: ${entry.line}` : entry.path)}`);
  }
  for (const entry of kept) reporter.skipped(entry.path, entry.reason);
  console.log('');

  if (dryRun) return { removed: 0, kept: kept.length };

  // Committed content can be recovered; uncommitted content cannot.
  const targets = remove.filter((e) => e.type !== 'gitignore-line').map((e) => e.path);
  const dirty = dirtyPaths(root, targets);
  if (dirty.length && !force) {
    reporter.warn(
      `${dirty.length} path(s) have uncommitted changes — refusing to delete them`,
      'commit or stash first, or re-run with --force to delete anyway',
    );
    for (const p of dirty.slice(0, 10)) console.log(`    ${p}`);
    return { removed: 0, kept: kept.length, blocked: dirty.length };
  }

  if (!yes) {
    if (!interactive()) {
      reporter.warn('no TTY and no --yes — refusing to delete anything');
      return { removed: 0, kept: kept.length, blocked: remove.length };
    }
    const prompt = createPrompt();
    let confirmed = false;
    try {
      confirmed = await prompt.confirm(`type ${cyan('reset')} to confirm:`, 'reset');
    } finally {
      prompt.close();
    }
    if (!confirmed) {
      reporter.info('cancelled, nothing removed');
      return { removed: 0, kept: kept.length };
    }
  }

  let removed = 0;
  for (const entry of remove) {
    if (entry.type === 'gitignore-line') {
      if (dropGitignoreLine(root, entry.line, dryRun)) {
        reporter.info(`removed .gitignore line ${entry.line}`);
        removed += 1;
      }
      continue;
    }

    const target = path.join(root, entry.path);
    if (!inside(root, target)) continue;
    if (removePath(target)) {
      reporter.info(`removed ${entry.path}`);
      removed += 1;
    }
  }

  if (kept.length) {
    // Kept files are still ours to remove later with --force, so the manifest
    // shrinks to exactly them instead of disappearing.
    const remaining = manifest.entries.filter(
      (e) => kept.some((k) => k.path === e.path) || e.type === 'dir',
    );
    fs.writeFileSync(
      path.join(root, MANIFEST_PATH),
      JSON.stringify({ ...manifest, entries: remaining }, null, 2) + '\n',
    );
  } else if (removePath(path.join(root, MANIFEST_PATH))) {
    reporter.info(`removed ${MANIFEST_PATH}`);
  }

  // Directories the scaffold created, only if the user left nothing in them.
  const dirs = manifest.entries
    .filter((e) => e.type === 'dir')
    .map((e) => path.join(root, e.path))
    .sort((a, b) => b.length - a.length);
  for (const dir of dirs) if (inside(root, dir) && removeIfEmpty(dir)) reporter.info(`removed ${path.relative(root, dir)}/`);

  console.log('');
  reporter.info(`${removed} removed, ${kept.length} kept`);
  if (kept.length) reporter.info(dim('kept files were modified after init — use --force to remove them too'));

  return { removed, kept: kept.length };
}
