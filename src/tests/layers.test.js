import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { packageRoot } from '../project.js';

/**
 * The folders under src/ are layers, and a layer only ever reaches downwards.
 * Without this test they are decoration: one import the wrong way and the
 * structure says something that is no longer true.
 */

const SRC = path.join(packageRoot, 'src');

/** Which layers a file in `layer` is allowed to import from. */
const REACHES = {
  '': [''],                                     // the foundation depends on nothing else
  platform: ['', 'platform'],                   // the machine: files, terminal
  model: ['', 'platform', 'model'],             // what the package knows
  commands: ['', 'platform', 'model', 'commands'], // the verbs, and what they print
};

/** Every module under src/, excluding templates and tests, as [layer, file]. */
function modules() {
  const found = [];

  for (const layer of Object.keys(REACHES)) {
    const dir = path.join(SRC, layer);
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.js')) found.push([layer, path.join(dir, name)]);
    }
  }

  return found;
}

/** The layer a relative import resolves into. */
function layerOf(file, specifier) {
  const target = path.resolve(path.dirname(file), specifier);
  const rel = path.relative(SRC, target);
  return rel.includes(path.sep) ? rel.split(path.sep)[0] : '';
}

const localImports = (content) => [...content.matchAll(/from '(\.[^']+)'/g)].map((m) => m[1]);

describe('the layers under src/', () => {
  it('only ever reach downwards', () => {
    for (const [layer, file] of modules()) {
      const allowed = REACHES[layer];

      for (const specifier of localImports(fs.readFileSync(file, 'utf8'))) {
        const target = layerOf(file, specifier);

        assert.ok(
          allowed.includes(target),
          `${path.relative(SRC, file)} imports ${specifier}: ${layer || 'the foundation'} must not reach into ${target || 'the foundation'}`,
        );
      }
    }
  });

  // constants.js is imported by every layer, so anything it imported would be
  // imported by every layer too.
  it('leave constants.js depending on nothing of ours', () => {
    assert.deepEqual(localImports(fs.readFileSync(path.join(SRC, 'constants.js'), 'utf8')), []);
  });

  it('leave project.js depending on nothing of ours, so it can never close a cycle', () => {
    assert.deepEqual(localImports(fs.readFileSync(path.join(SRC, 'project.js'), 'utf8')), []);
  });

  it('keep every module in a layer, with nothing loose at the root', () => {
    const root = fs
      .readdirSync(SRC)
      .filter((name) => name.endsWith('.js'))
      .sort();

    assert.deepEqual(root, ['constants.js', 'project.js', 'utils.js']);
  });

  it('mirror the layout in the tests', () => {
    for (const [layer, file] of modules()) {
      // constants.js declares values and no behaviour. A test over it could only
      // restate the file, and would fail every time a name legitimately changes.
      if (file.endsWith('constants.js')) continue;

      const test = path.join(SRC, 'tests', layer, `${path.basename(file, '.js')}.test.js`);

      assert.ok(fs.existsSync(test), `${path.relative(SRC, file)} has no test at ${path.relative(SRC, test)}`);
    }
  });
});
