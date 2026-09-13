import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** A scratch directory that cleans itself up when the test process exits. */
const created = [];
process.on('exit', () => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

export function tmpDir(prefix = 'agentic-test-') {
  // realpath: on macOS os.tmpdir() is a symlink, and the code under test
  // resolves paths without following it.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  created.push(dir);
  return dir;
}

/** A project root with a package.json, since findProjectRoot needs one. */
export function tmpProject(name = 'fixture') {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name }, null, 2) + '\n');
  return dir;
}

/** Records what the code under test reported instead of printing it. */
export function fakeReporter() {
  const calls = { created: [], skipped: [], warnings: [], info: [] };

  return {
    calls,
    counts: { created: 0, skipped: 0, warnings: 0 },
    created(what) {
      calls.created.push(what);
      this.counts.created += 1;
    },
    skipped(what, why) {
      calls.skipped.push(why ? `${what} (${why})` : what);
      this.counts.skipped += 1;
    },
    warn(message, hint) {
      calls.warnings.push(hint ? `${message} :: ${hint}` : message);
      this.counts.warnings += 1;
    },
    info(message) {
      calls.info.push(message);
    },
    has(list, substring) {
      return calls[list].some((entry) => entry.includes(substring));
    },
  };
}

export function opts(reporter, extra = {}) {
  return { dryRun: false, force: false, reporter, ...extra };
}

/** Runs `fn` with console output swallowed; returns what it printed. */
export async function silenced(fn) {
  const original = { log: console.log, warn: console.warn, error: console.error };
  const output = [];
  const capture = (...args) => output.push(args.join(' '));

  console.log = capture;
  console.warn = capture;
  console.error = capture;

  try {
    const value = await fn();
    return { value, output: output.join('\n') };
  } finally {
    Object.assign(console, original);
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
