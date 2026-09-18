import fs from 'node:fs';
import path from 'node:path';

import { dim, green, red, yellow } from './color.ts';
import { PREFIX } from '../constants.ts';
import { hash } from '../utils.ts';

/** How many of each thing a run did. The summary line is built from it. */
export interface Counts {
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  warnings: number;
}

/**
 * Where a command says what it did. Tests pass one that records instead of
 * printing, which is why everything that reports takes it as an argument.
 */
export interface Reporter {
  readonly counts: Counts;
  created(what: string): void;
  updated(what: string): void;
  removed(what: string): void;
  skipped(what: string, why?: string): void;
  warn(message: string, hint?: string): void;
  info(message: string): void;
}

/** What every write takes: whether to touch the disk, and where to say what happened. */
export interface WriteOptions {
  dryRun: boolean;
  reporter: Reporter;
  /** The path shown in the report, when it should differ from the one written. */
  label?: string;
}

/** What a command hands down to everything it calls. */
export interface RunOptions extends WriteOptions {
  force: boolean;
}

/** 'blocked' means something that is not a directory sits at the path. */
export type DirResult = 'created' | 'exists' | 'blocked';

export type WriteResult = 'created' | 'updated' | 'skipped' | 'conflict';

export interface CopyOptions extends WriteOptions {
  label: string;
  /** Fires for every file walked, written or not. */
  onFile?: (file: string, content: string, what: WriteResult) => void;
  onDir?: (dir: string) => void;
  transform?: (content: string) => string;
  /** What the manifest recorded for a destination file, if anything. */
  knownHash?: (file: string) => string | undefined;
}

export interface Warning {
  message: string;
  hint?: string;
}

/** The prefix every line carries, kept out of the way of what matters. */
const tag = () => dim(PREFIX);

/**
 * Collects and prints what init did, so the run ends with one readable summary
 * instead of a wall of interleaved messages.
 */
export function createReporter({ dryRun = false }: { dryRun?: boolean } = {}): Reporter & { warnings: Warning[] } {
  const counts: Counts = { created: 0, updated: 0, removed: 0, skipped: 0, warnings: 0 };
  const warnings: Warning[] = [];

  return {
    counts,
    warnings,
    created(what) {
      counts.created += 1;
      // The verb is coloured, the spacing around it is not — the columns line up
      // the same whether or not the escapes are there.
      console.log(`${tag()} ${green(dryRun ? 'would create' : 'created')}  ${what}`);
    },
    updated(what) {
      counts.updated += 1;
      console.log(`${tag()} ${green(dryRun ? 'would update' : 'updated')}  ${what}`);
    },
    removed(what) {
      counts.removed += 1;
      console.log(`${tag()} ${red(dryRun ? 'would remove' : 'removed')}  ${what}`);
    },
    skipped(what, why) {
      counts.skipped += 1;
      console.log(`${tag()} ${dim('skip')}     ${what}${why ? dim(` (${why})`) : ''}`);
    },
    warn(message, hint) {
      counts.warnings += 1;
      warnings.push({ message, hint });
      console.warn(`${tag()} ${yellow('warn')}     ${message}`);
      if (hint) console.warn(`${tag()}          ${dim(hint)}`);
    },
    info(message) {
      console.log(`${tag()} ${message}`);
    },
  };
}

/**
 * What is at `target`, or null. `throwIfNoEntry` only covers ENOENT, and a path
 * that runs *through* a file (`agentic/x` when `agentic` is a file) throws
 * ENOTDIR instead — every caller here means the same thing by both: nothing
 * usable is there.
 */
export function statOrNull(target: string): fs.Stats | null {
  try {
    return fs.lstatSync(target, { throwIfNoEntry: false }) ?? null;
  } catch {
    return null;
  }
}

/** Refuses anything that would escape the project root. Guards every delete. */
export function inside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** 'blocked' means a non-directory sits at that path, so callers must not descend into it. */
export function ensureDir(dir: string, { dryRun, reporter, label }: WriteOptions): DirResult {
  const name = label ?? dir;
  const stat = statOrNull(dir);

  if (stat?.isDirectory()) {
    reporter.skipped(name, 'already exists');
    return 'exists';
  }
  if (stat) {
    reporter.warn(`${name} exists but is not a directory`, 'remove or rename it, then run agentic-flow init again');
    return 'blocked';
  }
  if (!dryRun) fs.mkdirSync(dir, { recursive: true });
  reporter.created(name);
  return 'created';
}

export function writeIfMissing(file: string, content: string, { dryRun, reporter, label }: WriteOptions): boolean {
  const name = label ?? file;

  if (statOrNull(file)) {
    reporter.skipped(name, 'already exists');
    return false;
  }
  if (!dryRun) fs.writeFileSync(file, content);
  reporter.created(name);
  return true;
}

/**
 * Creates `linkPath` -> `target` (target is relative to the link's directory,
 * which keeps the repository portable). Never overwrites real files or
 * directories; `force` only rewrites a symlink that points somewhere else.
 */
export function ensureSymlink(
  linkPath: string,
  target: string,
  { dryRun, force = false, reporter, type = 'file', label }: WriteOptions & { force?: boolean; type?: 'file' | 'dir' },
): boolean {
  const name = label ?? linkPath;
  const dir = path.dirname(linkPath);
  const stat = statOrNull(linkPath);

  if (stat?.isSymbolicLink()) {
    const current = fs.readlinkSync(linkPath);
    if (path.resolve(dir, current) === path.resolve(dir, target)) {
      reporter.skipped(name, `already links to ${target}`);
      return false;
    }
    if (!force) {
      reporter.warn(
        `${name} is a symlink to ${current}, expected ${target}`,
        'run agentic-flow init --force to repoint it',
      );
      return false;
    }
    if (!dryRun) fs.unlinkSync(linkPath);
  } else if (stat) {
    const kind = stat.isDirectory() ? 'a real directory' : 'a real file';
    reporter.warn(
      `${name} already exists as ${kind} — left untouched`,
      stat.isDirectory()
        ? `nothing inside it is read as ours — move its contents into ${target}/, delete ${name}, then run agentic-flow init again`
        : `merge it into ${target} by hand, delete ${name}, then run agentic-flow init again`,
    );
    return false;
  }

  if (dryRun) {
    reporter.created(`${name} -> ${target}`);
    return true;
  }

  try {
    // 'junction' works on Windows without Developer Mode or admin rights.
    fs.symlinkSync(target, linkPath, type === 'dir' && process.platform === 'win32' ? 'junction' : type);
    reporter.created(`${name} -> ${target}`);
    return true;
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if ((code === 'EPERM' || code === 'EACCES') && type === 'file') {
      fs.copyFileSync(path.resolve(dir, target), linkPath);
      reporter.warn(
        `could not symlink ${name}, copied ${target} instead`,
        'the two files are now independent — enable Developer Mode on Windows for real symlinks',
      );
      return true;
    }
    throw error;
  }
}

/**
 * Writes a file we own. The manifest's `knownHash` is what makes this safe: it
 * says what the file looked like when we last wrote it, so a file nobody touched
 * can be brought up to date while an edited one is left exactly as it is.
 */
export function writeManaged(
  file: string,
  content: string,
  { dryRun, reporter, label, knownHash }: WriteOptions & { knownHash?: string | undefined },
): WriteResult {
  const name = label ?? file;
  const stat = statOrNull(file);

  if (!stat) {
    if (!dryRun) fs.writeFileSync(file, content);
    reporter.created(name);
    return 'created';
  }

  // A directory or a symlink where a file belongs. Reading it throws, and the
  // whole run would die on one odd path, so say what is wrong and carry on.
  if (!stat.isFile()) {
    reporter.warn(
      `${name} exists but is not a regular file — left untouched`,
      'remove or rename it, then run agentic-flow init again',
    );
    return 'skipped';
  }

  const current = fs.readFileSync(file, 'utf8');
  if (current === content) {
    reporter.skipped(name, 'already up to date');
    return 'skipped';
  }

  // No record of writing it → not ours to touch.
  if (!knownHash) {
    reporter.skipped(name, 'already exists');
    return 'skipped';
  }

  if (hash(current) === knownHash) {
    if (!dryRun) fs.writeFileSync(file, content);
    reporter.updated(name);
    return 'updated';
  }

  // Edited. Worth saying only when the package actually has something newer —
  // otherwise everyone who customises a skill gets nagged on every run.
  if (knownHash !== hash(content)) {
    reporter.warn(
      `${name} was edited, and the package has a newer version — left as it is`,
      'delete it to take the new one, or merge the two by hand',
    );
    return 'conflict';
  }

  reporter.skipped(name, 'your version');
  return 'skipped';
}

/**
 * Copies `srcDir` into `destDir` file by file. Missing files are created;
 * `knownHash(destPath)` decides what happens to the ones already there — see
 * `writeManaged`. `label` is the path shown in the report.
 *
 * `onFile` fires for every file walked, not only the ones written: a file
 * skipped as already up to date is still a file this package ships, and the
 * caller has to be able to tell that from one it no longer ships at all.
 */
export function copyTree(srcDir: string, destDir: string, options: CopyOptions): void {
  const { dryRun, reporter, label, onFile, transform, knownHash } = options;

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    const name = `${label}/${entry.name}`;

    if (entry.isDirectory()) {
      if (ensureDir(to, { dryRun, reporter, label: `${name}/` }) === 'blocked') continue;
      options.onDir?.(to);
      copyTree(from, to, { ...options, label: name });
      continue;
    }

    const raw = fs.readFileSync(from, 'utf8');
    const content = transform ? transform(raw) : raw;
    const what = writeManaged(to, content, { dryRun, reporter, label: name, knownHash: knownHash?.(to) });
    onFile?.(to, content, what);
  }
}

/** Removes a path without ever following a symlink into a directory. */
export function removePath(target: string): boolean {
  const stat = statOrNull(target);
  if (!stat) return false;

  if (stat.isSymbolicLink() || stat.isFile()) fs.unlinkSync(target);
  else fs.rmSync(target, { recursive: true, force: true });

  return true;
}

/** Deletes a directory only when it holds nothing. */
export function removeIfEmpty(dir: string): boolean {
  const stat = statOrNull(dir);
  if (!stat?.isDirectory()) return false;
  if (fs.readdirSync(dir).length) return false;

  fs.rmdirSync(dir);
  return true;
}
