import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  copyTree,
  ensureDir,
  ensureSymlink,
  removeIfEmpty,
  removePath,
  statOrNull,
  writeIfMissing,
  writeManaged,
} from '../../platform/fsx.ts';
import { hash } from '../../utils.ts';
import { fakeReporter, opts, tmpDir } from '../helpers.ts';

describe('ensureDir', () => {
  it('creates a missing directory', () => {
    const root = tmpDir();
    const reporter = fakeReporter();

    assert.equal(ensureDir(path.join(root, 'a/b'), opts(reporter)), 'created');
    assert.ok(fs.statSync(path.join(root, 'a/b')).isDirectory());
  });

  it('reports an existing directory as unchanged', () => {
    const root = tmpDir();
    const reporter = fakeReporter();

    ensureDir(path.join(root, 'a'), opts(reporter));
    assert.equal(ensureDir(path.join(root, 'a'), opts(reporter)), 'exists');
  });

  // A file sitting where a directory belongs must stop the caller descending.
  it('reports a non-directory as blocked and warns', () => {
    const root = tmpDir();
    const reporter = fakeReporter();
    fs.writeFileSync(path.join(root, 'a'), 'not a dir');

    assert.equal(ensureDir(path.join(root, 'a'), opts(reporter)), 'blocked');
    assert.ok(reporter.has('warnings', 'not a directory'));
  });

  it('writes nothing on a dry run', () => {
    const root = tmpDir();
    ensureDir(path.join(root, 'a'), opts(fakeReporter(), { dryRun: true }));
    assert.equal(statOrNull(path.join(root, 'a')), null);
  });
});

describe('writeIfMissing', () => {
  it('writes a new file and reports it', () => {
    const root = tmpDir();
    const reporter = fakeReporter();

    assert.equal(writeIfMissing(path.join(root, 'f.md'), 'body', opts(reporter)), true);
    assert.equal(fs.readFileSync(path.join(root, 'f.md'), 'utf8'), 'body');
  });

  it('never overwrites an existing file', () => {
    const root = tmpDir();
    const file = path.join(root, 'f.md');
    fs.writeFileSync(file, 'mine');

    assert.equal(writeIfMissing(file, 'theirs', opts(fakeReporter())), false);
    assert.equal(fs.readFileSync(file, 'utf8'), 'mine');
  });
});

describe('ensureSymlink', () => {
  it('creates a relative link', () => {
    const root = tmpDir();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '#');

    assert.equal(
      ensureSymlink(path.join(root, 'CLAUDE.md'), 'AGENTS.md', opts(fakeReporter(), { type: 'file' })),
      true,
    );
    assert.equal(fs.readlinkSync(path.join(root, 'CLAUDE.md')), 'AGENTS.md');
  });

  it('is a no-op when the link already points at the target', () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'agentic'));
    const link = path.join(root, '.claude');
    const options = opts(fakeReporter(), { type: 'dir' });

    ensureSymlink(link, 'agentic', options);
    assert.equal(ensureSymlink(link, 'agentic', options), false);
  });

  it('refuses to replace a real directory', () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'agentic'));
    fs.mkdirSync(path.join(root, '.claude'));
    fs.writeFileSync(path.join(root, '.claude', 'settings.json'), '{}');
    const reporter = fakeReporter();

    assert.equal(ensureSymlink(path.join(root, '.claude'), 'agentic', opts(reporter, { type: 'dir' })), false);
    assert.ok(fs.existsSync(path.join(root, '.claude', 'settings.json')));
    assert.ok(reporter.has('warnings', 'real directory'));
  });

  it('refuses to replace a real file', () => {
    const root = tmpDir();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '#');
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'my own notes');

    ensureSymlink(path.join(root, 'CLAUDE.md'), 'AGENTS.md', opts(fakeReporter(), { type: 'file' }));
    assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), 'my own notes');
  });

  it('warns about a link pointing elsewhere, and repoints it only with force', () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'agentic'));
    fs.mkdirSync(path.join(root, 'elsewhere'));
    const link = path.join(root, '.claude');
    fs.symlinkSync('elsewhere', link);
    const reporter = fakeReporter();

    assert.equal(ensureSymlink(link, 'agentic', opts(reporter, { type: 'dir' })), false);
    assert.ok(reporter.has('warnings', 'expected agentic'));

    assert.equal(ensureSymlink(link, 'agentic', opts(reporter, { type: 'dir', force: true })), true);
    assert.equal(fs.readlinkSync(link), 'agentic');
  });
});

describe('copyTree', () => {
  const seed = (root: string) => {
    fs.mkdirSync(path.join(root, 'src', 'skills', 'spec'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'skills', 'spec', 'SKILL.md'), 'skill');
    fs.writeFileSync(path.join(root, 'src', 'top.md'), 'top');
  };

  it('copies the tree and reports every file', () => {
    const root = tmpDir();
    seed(root);
    const dest = path.join(root, 'dest');
    fs.mkdirSync(dest);
    const files = [];

    copyTree(path.join(root, 'src'), dest, {
      ...opts(fakeReporter()),
      label: 'dest',
      onFile: (file) => files.push(path.relative(dest, file)),
    });

    assert.equal(fs.readFileSync(path.join(dest, 'skills', 'spec', 'SKILL.md'), 'utf8'), 'skill');
    assert.equal(files.length, 2);
  });

  it('leaves files the user already has', () => {
    const root = tmpDir();
    seed(root);
    const dest = path.join(root, 'dest');
    fs.mkdirSync(dest);
    fs.writeFileSync(path.join(dest, 'top.md'), 'edited by hand');

    copyTree(path.join(root, 'src'), dest, { ...opts(fakeReporter()), label: 'dest' });
    assert.equal(fs.readFileSync(path.join(dest, 'top.md'), 'utf8'), 'edited by hand');
  });

  it('applies transform to the content it writes', () => {
    const root = tmpDir();
    seed(root);
    const dest = path.join(root, 'dest');
    fs.mkdirSync(dest);

    copyTree(path.join(root, 'src'), dest, {
      ...opts(fakeReporter()),
      label: 'dest',
      transform: (content) => content.toUpperCase(),
    });

    assert.equal(fs.readFileSync(path.join(dest, 'top.md'), 'utf8'), 'TOP');
  });
});

describe('removePath', () => {
  // The .claude symlink points at agentic/; following it would delete the content.
  it('unlinks a directory symlink without touching what it points at', () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'agentic'));
    fs.writeFileSync(path.join(root, 'agentic', 'keep.md'), 'keep');
    fs.symlinkSync('agentic', path.join(root, '.claude'));

    assert.equal(removePath(path.join(root, '.claude')), true);
    assert.equal(fs.existsSync(path.join(root, '.claude')), false);
    assert.equal(fs.readFileSync(path.join(root, 'agentic', 'keep.md'), 'utf8'), 'keep');
  });

  it('reports false for a path that is not there', () => {
    assert.equal(removePath(path.join(tmpDir(), 'nope')), false);
  });
});

describe('removeIfEmpty', () => {
  it('removes an empty directory', () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'empty'));
    assert.equal(removeIfEmpty(path.join(root, 'empty')), true);
  });

  it('keeps a directory that still holds something', () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'full'));
    fs.writeFileSync(path.join(root, 'full', 'mine.md'), 'mine');

    assert.equal(removeIfEmpty(path.join(root, 'full')), false);
    assert.ok(fs.existsSync(path.join(root, 'full', 'mine.md')));
  });
});

describe('writeManaged', () => {
  const file = (root: string) => path.join(root, 'skill.md');
  const write = (root: string, body: string) => fs.writeFileSync(file(root), body);
  const read = (root: string) => fs.readFileSync(file(root), 'utf8');

  it('creates what is not there', () => {
    const root = tmpDir();
    const reporter = fakeReporter();

    assert.equal(writeManaged(file(root), 'v2', opts(reporter)), 'created');
    assert.equal(read(root), 'v2');
  });

  // Reading a directory throws, and one odd path must not end the whole run.
  it('warns instead of throwing when a directory stands where the file belongs', () => {
    const root = tmpDir();
    fs.mkdirSync(file(root));
    const reporter = fakeReporter();

    assert.equal(writeManaged(file(root), 'v2', opts(reporter, { knownHash: hash('v1') })), 'skipped');
    assert.ok(reporter.has('warnings', 'not a regular file'));
    assert.ok(fs.statSync(file(root)).isDirectory());
  });

  it('says nothing useful when the file already matches', () => {
    const root = tmpDir();
    write(root, 'v2');
    const reporter = fakeReporter();

    assert.equal(writeManaged(file(root), 'v2', opts(reporter, { knownHash: hash('v2') })), 'skipped');
    assert.ok(reporter.has('skipped', 'already up to date'));
  });

  it('updates a file nobody touched since we wrote it', () => {
    const root = tmpDir();
    write(root, 'v1');
    const reporter = fakeReporter();

    assert.equal(writeManaged(file(root), 'v2', opts(reporter, { knownHash: hash('v1') })), 'updated');
    assert.equal(read(root), 'v2');
    assert.equal(reporter.counts.updated, 1);
  });

  it('writes nothing on a dry run', () => {
    const root = tmpDir();
    write(root, 'v1');

    const reporter = fakeReporter();
    const result = writeManaged(file(root), 'v2', { ...opts(reporter, { knownHash: hash('v1') }), dryRun: true });

    assert.equal(result, 'updated');
    assert.equal(read(root), 'v1');
  });

  it('keeps an edited file quietly when the package has nothing newer', () => {
    const root = tmpDir();
    write(root, 'v2 plus my own line');
    const reporter = fakeReporter();

    // knownHash is the hash of v2 — the version we wrote and still ship.
    assert.equal(writeManaged(file(root), 'v2', opts(reporter, { knownHash: hash('v2') })), 'skipped');
    assert.equal(read(root), 'v2 plus my own line');
    assert.equal(reporter.counts.warnings, 0);
  });

  it('warns when a file was edited and a newer version exists', () => {
    const root = tmpDir();
    write(root, 'v1 plus my own line');
    const reporter = fakeReporter();

    assert.equal(writeManaged(file(root), 'v2', opts(reporter, { knownHash: hash('v1') })), 'conflict');
    assert.equal(read(root), 'v1 plus my own line');
    assert.ok(reporter.has('warnings', 'newer version'));
  });

  it('will not touch a file it has no record of writing', () => {
    const root = tmpDir();
    write(root, 'someone else wrote this');
    const reporter = fakeReporter();

    assert.equal(writeManaged(file(root), 'v2', opts(reporter)), 'skipped');
    assert.equal(read(root), 'someone else wrote this');
  });
});
