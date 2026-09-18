import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { findProjectRoot, ownPackage, packageRoot, projectName } from '../project.ts';
import { tmpDir, tmpProject, writeJson } from './helpers.ts';

describe('findProjectRoot', () => {
  it('finds the package.json in the directory itself', () => {
    const root = tmpProject();
    assert.equal(findProjectRoot(root)?.root, root);
  });

  it('walks up from a nested directory', () => {
    const root = tmpProject();
    const deep = path.join(root, 'src', 'a', 'b');
    fs.mkdirSync(deep, { recursive: true });

    assert.equal(findProjectRoot(deep)?.root, root);
  });

  it('stops at the nearest package.json, not the outermost', () => {
    const root = tmpProject('outer');
    const inner = path.join(root, 'packages', 'inner');
    fs.mkdirSync(inner, { recursive: true });
    writeJson(path.join(inner, 'package.json'), { name: 'inner' });

    assert.equal(findProjectRoot(inner)?.root, inner);
  });
});

describe('projectName', () => {
  it('uses the name from package.json', () => {
    const root = tmpProject('my-app');
    assert.equal(projectName(root, path.join(root, 'package.json')), 'my-app');
  });

  it('falls back to the directory name when the file is unusable', () => {
    const root = tmpDir();
    fs.writeFileSync(path.join(root, 'package.json'), '{ broken');

    assert.equal(projectName(root, path.join(root, 'package.json')), path.basename(root));
  });

  it('falls back when package.json has no name', () => {
    const root = tmpDir();
    writeJson(path.join(root, 'package.json'), { version: '1.0.0' });

    assert.equal(projectName(root, path.join(root, 'package.json')), path.basename(root));
  });
});

describe('ownPackage', () => {
  // Deliberately not asserting the package name: it is free to change.
  it('reads this package, so the CLI can report its version', () => {
    const pkg = ownPackage();
    assert.match(pkg.version, /^\d+\.\d+\.\d+/);
    assert.ok(pkg.name);
  });

  // Reads the bin path out of package.json so renaming the command cannot break it.
  // The bin ships compiled from dist/; its source is the same path, as .ts, from
  // the root. Checking the source keeps this test independent of a build.
  it('resolves packageRoot to the directory holding the CLI', () => {
    const [binPath] = Object.values(ownPackage().bin ?? {});
    assert.ok(binPath, 'package.json declares no bin');
    assert.match(binPath, /^dist\/.*\.js$/);

    const source = binPath.replace(/^dist\//, '').replace(/\.js$/, '.ts');
    assert.ok(fs.existsSync(path.join(packageRoot, source)), source);
    assert.ok(fs.existsSync(path.join(packageRoot, 'src', 'templates', 'seed')));
  });
});
