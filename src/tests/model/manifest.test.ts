import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { MANIFEST_PATH } from '../../constants.ts';
import { createManifest, readManifest, recordedHash } from '../../model/manifest.ts';
import { hash } from '../../utils.ts';
import { ownPackage } from '../../project.ts';
import { defined, tmpDir } from '../helpers.ts';

describe('createManifest', () => {
  it('records files with their content hash and reads back', () => {
    const root = tmpDir();
    const manifest = createManifest(root);
    manifest.addFile(path.join(root, 'AGENTS.md'), 'body');
    manifest.write({ dryRun: false });

    const entry = defined(readManifest(root)).entries.find((e) => e.path === 'AGENTS.md');
    assert.deepEqual(entry, { path: 'AGENTS.md', type: 'file', hash: hash('body') });
  });

  it('records symlinks with their target and directories without a hash', () => {
    const root = tmpDir();
    const manifest = createManifest(root);
    manifest.addLink(path.join(root, '.claude'), 'agentic');
    manifest.addDir(path.join(root, 'agentic'));
    manifest.write({ dryRun: false });

    const entries = defined(readManifest(root)).entries;
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

    const paths = defined(readManifest(root)).entries.map((e) => e.path);
    assert.deepEqual(paths.sort(), ['a.md', 'b.md']);
  });

  it('replaces an entry rather than duplicating it', () => {
    const root = tmpDir();
    const manifest = createManifest(root);
    manifest.addFile(path.join(root, 'a.md'), 'first');
    manifest.addFile(path.join(root, 'a.md'), 'second');
    manifest.write({ dryRun: false });

    const entries = defined(readManifest(root)).entries.filter((e) => e.path === 'a.md');
    assert.equal(entries.length, 1);
    assert.equal(recordedHash(entries, 'a.md'), hash('second'));
  });

  it('forgets an entry it was told to remove', () => {
    const root = tmpDir();
    const first = createManifest(root);
    first.addFile(path.join(root, 'a.md'), 'a');
    first.addFile(path.join(root, 'b.md'), 'b');
    first.write({ dryRun: false });

    const second = createManifest(root);
    second.remove('a.md');
    second.write({ dryRun: false });

    assert.deepEqual(defined(readManifest(root)).entries.map((e) => e.path), ['b.md']);
  });

  it('records the package version it was given', () => {
    const root = tmpDir();
    const manifest = createManifest(root);
    manifest.addFile(path.join(root, 'a.md'), 'a');
    manifest.write({ dryRun: false, version: ownPackage().version });

    assert.equal(defined(readManifest(root)).packageVersion, ownPackage().version);
  });

  // Only init scaffolds, so only init says which version did. Every other
  // command has to leave that answer as it found it.
  it('carries the recorded version forward when it is given none', () => {
    const root = tmpDir();
    createManifest(root).write({ dryRun: false, version: '0.0.1' });

    createManifest(root).write({ dryRun: false });

    assert.equal(defined(readManifest(root)).packageVersion, '0.0.1');
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

  // Written before we recorded it. Reads as "unknown", never as undefined.
  it('reports no version for a manifest that predates the field', () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'agentic'), { recursive: true });
    fs.writeFileSync(path.join(root, MANIFEST_PATH), JSON.stringify({ version: 1, entries: [] }));

    assert.equal(defined(readManifest(root)).packageVersion, null);
  });
});
