import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ManifestData, ManifestEntry } from '../model/manifest.ts';
import type { Counts, Reporter, RunOptions } from '../platform/fsx.ts';

/** A scratch directory that cleans itself up when the test process exits. */
const created: string[] = [];
process.on('exit', () => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

export function tmpDir(prefix = 'agentic-test-'): string {
  // realpath: on macOS os.tmpdir() is a symlink, and the code under test
  // resolves paths without following it.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  created.push(dir);
  return dir;
}

// The scaffold looks for MCP servers in the user's home directory. Whoever runs
// the suite has their own servers there, so point HOME at an empty directory:
// the tests must give the same answer on every machine.
const fakeHome = tmpDir('agentic-home-');
process.env.HOME = fakeHome;
process.env.USERPROFILE = fakeHome;

/** A project root with a package.json, since findProjectRoot needs one. */
export function tmpProject(name = 'fixture'): string {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name }, null, 2) + '\n');
  return dir;
}

/** What a fake reporter keeps: one list per kind of call. */
export type Calls = Record<'created' | 'updated' | 'removed' | 'skipped' | 'warnings' | 'info', string[]>;

export interface FakeReporter extends Reporter {
  readonly calls: Calls;
  has(list: keyof Calls, substring: string): boolean;
}

/** Records what the code under test reported instead of printing it. */
export function fakeReporter(): FakeReporter {
  const calls: Calls = { created: [], updated: [], removed: [], skipped: [], warnings: [], info: [] };
  const counts: Counts = { created: 0, updated: 0, removed: 0, skipped: 0, warnings: 0 };

  return {
    calls,
    counts,
    created(what) {
      calls.created.push(what);
      counts.created += 1;
    },
    updated(what) {
      calls.updated.push(what);
      counts.updated += 1;
    },
    removed(what) {
      calls.removed.push(what);
      counts.removed += 1;
    },
    skipped(what, why) {
      calls.skipped.push(why ? `${what} (${why})` : what);
      counts.skipped += 1;
    },
    warn(message, hint) {
      calls.warnings.push(hint ? `${message} :: ${hint}` : message);
      counts.warnings += 1;
    },
    info(message) {
      calls.info.push(message);
    },
    has(list, substring) {
      return calls[list].some((entry) => entry.includes(substring));
    },
  };
}

/** The options every write takes, with whatever one test needs on top. */
export function opts<const Extra extends object = object>(reporter: Reporter, extra?: Extra): RunOptions & Extra {
  return { dryRun: false, force: false, reporter, ...extra } as RunOptions & Extra;
}

const ANSI = /\[[0-9;]*m/g;

/**
 * Colour depends on whether stdout is a terminal, and tests must not. Strip the
 * escapes before anything is matched against the output.
 */
export const plain = (text: string): string => text.replace(ANSI, '');

/** Runs `fn` with console output swallowed; returns what it printed, uncoloured. */
export async function silenced<T>(fn: () => T | Promise<T>): Promise<{ value: T; output: string }> {
  const original = { log: console.log, warn: console.warn, error: console.error };
  const output: string[] = [];
  const capture = (...args: unknown[]) => output.push(args.join(' '));

  console.log = capture;
  console.warn = capture;
  console.error = capture;

  try {
    const value = await fn();
    return { value, output: plain(output.join('\n')) };
  } finally {
    Object.assign(console, original);
  }
}

export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/** `value`, or a failed test when it is missing — so what follows can use it without asking again. */
export function defined<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) assert.fail(`expected a ${what}, got ${value}`);
  return value;
}

/** The manifest's entry for the file at `rel`, or a failed test when it records none. */
export function fileEntry(manifest: ManifestData, rel: string): Extract<ManifestEntry, { type: 'file' }> {
  const entry = manifest.entries.find((e) => e.path === rel);
  if (entry?.type !== 'file') assert.fail(`the manifest records no file at ${rel}`);
  return entry;
}
