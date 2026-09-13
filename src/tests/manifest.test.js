import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { MANIFEST_PATH, createManifest, hash, readManifest } from '../manifest.js';
import { tmpDir } from './helpers.js';

describe('hash', () => {
  it('is stable for the same content', () => {
    assert.equal(hash('body'), hash('body'));
  });

  it('changes when the content changes', () => {
    assert.notEqual(hash('body'), hash('body '));
  });
});

describe('createManifest', () => {
  it('records files with their content hash and reads back', () => {
    const root = tmpDir();
    const manifest = createManifest(root);
    manifest.addFile(path.join(root, 'AGENTS.md'), 'body');
    manifest.write({ dryRun: false });

    const entry = readManifest(root).entries.find((e) => e.path === 'AGENTS.md');
    assert.deepEqual(entry, { path: 'AGENTS.md', type: 'file', hash: hash('body') });
  });

  it('records symlinks with their target and directories without a hash', () => {
    const root = tmpDir();
    const manifest = createManifest(root);
    manifest.addLink(path.join(root, '.claude'), 'agentic');
    manifest.addDir(path.join(root, 'agentic'));
    manifest.write({ dryRun: false });

    const entries = readManifest(root).entries;
    assert.deepEqual(entries.find((e) => e.path === '.claude'), {
      path: '.claude',
      type: 'symlink',
      target: 'agentic',
    });
    assert.deepEqual(entries.find((e) => e.path === 'agentic'), { path: 'agentic', type: 'dir' });
  });

  it('carries earlier entries forward on a second run', () => {
    const root = tmpDir();
    const first = createManifest(root);
    first.addFile(path.join(root, 'a.md'), 'a');
    first.write({ dryRun: false });

    const second = createManifest(root);
    second.addFile(path.join(root, 'b.md'), 'b');
    second.write({ dryRun: false });

    const paths = readManifest(root).entries.map((e) => e.path);
    assert.deepEqual(paths.sort(), ['a.md', 'b.md']);
  });

  it('replaces an entry rather than duplicating it', () => {
    const root = tmpDir();
    const manifest = createManifest(root);
    manifest.addFile(path.join(root, 'a.md'), 'first');
    manifest.addFile(path.join(root, 'a.md'), 'second');
    manifest.write({ dryRun: false });

    const entries = readManifest(root).entries.filter((e) => e.path === 'a.md');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].hash, hash('second'));
  });

  it('writes nothing on a dry run', () => {
    const root = tmpDir();
    const manifest = createManifest(root);
    manifest.addFile(path.join(root, 'a.md'), 'a');
    manifest.write({ dryRun: true });

    assert.equal(fs.existsSync(path.join(root, MANIFEST_PATH)), false);
  });
});

describe('readManifest', () => {
  it('returns null when there is no manifest', () => {
    assert.equal(readManifest(tmpDir()), null);
  });

  it('returns null for a corrupt manifest instead of throwing', () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'agentic'), { recursive: true });
    fs.writeFileSync(path.join(root, MANIFEST_PATH), '{ broken');

    assert.equal(readManifest(root), null);
  });
});
