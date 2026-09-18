import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { packageRoot } from '../project.ts';

/**
 * The folders under src/ are layers, and a layer only ever reaches downwards.
 * Without this test they are decoration: one import the wrong way and the
 * structure says something that is no longer true.
 */

const SRC = path.join(packageRoot, 'src');

/** Which layers a file in `layer` is allowed to import from. Type imports count too. */
const REACHES: Readonly<Record<string, readonly string[]>> = {
  '': [''],                                     // the foundation depends on nothing else
  platform: ['', 'platform'],                   // the machine: files, terminal
  model: ['', 'platform', 'model'],             // what the package knows
  commands: ['', 'platform', 'model', 'commands'], // the verbs, and what they print
};

interface Module {
  layer: string;
  file: string;
}

/** Every module under src/, excluding templates and tests. */
function modules(): Module[] {
  const found: Module[] = [];

  for (const layer of Object.keys(REACHES)) {
    const dir = path.join(SRC, layer);
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.ts')) found.push({ layer, file: path.join(dir, name) });
    }
  }

  return found;
}

/** The layer a relative import resolves into. */
function layerOf(file: string, specifier: string): string {
  const target = path.resolve(path.dirname(file), specifier);
  const rel = path.relative(SRC, target);
  return rel.includes(path.sep) ? (rel.split(path.sep)[0] ?? '') : '';
}

const localImports = (content: string): string[] =>
  [...content.matchAll(/from '(\.[^']+)'/g)].map((match) => match[1] ?? '');

describe('the layers under src/', () => {
  it('only ever reach downwards', () => {
    for (const { layer, file } of modules()) {
      const allowed = REACHES[layer] ?? [];

      for (const specifier of localImports(fs.readFileSync(file, 'utf8'))) {
        const target = layerOf(file, specifier);

        assert.ok(
          allowed.includes(target),
          `${path.relative(SRC, file)} imports ${specifier}: ${layer || 'the foundation'} must not reach into ${target || 'the foundation'}`,
        );
      }
    }
  });

  // constants.ts is imported by every layer, so anything it imported would be
  // imported by every layer too.
  it('leave constants.ts depending on nothing of ours', () => {
    assert.deepEqual(localImports(fs.readFileSync(path.join(SRC, 'constants.ts'), 'utf8')), []);
  });

  it('leave project.ts depending on nothing of ours, so it can never close a cycle', () => {
    assert.deepEqual(localImports(fs.readFileSync(path.join(SRC, 'project.ts'), 'utf8')), []);
  });

  it('keep every module in a layer, with nothing loose at the root', () => {
    const root = fs
      .readdirSync(SRC)
      .filter((name) => name.endsWith('.ts'))
      .sort();

    assert.deepEqual(root, ['constants.ts', 'project.ts', 'utils.ts']);
  });

  // Only TypeScript under src/: a stray .js would run in tests and never be
  // type-checked, or ship beside its compiled twin.
  it('hold no JavaScript', () => {
    const stray = fs
      .globSync('**/*.{js,mjs,cjs}', { cwd: SRC })
      .filter((file) => !file.startsWith(`templates${path.sep}`));

    assert.deepEqual(stray, []);
  });

  it('mirror the layout in the tests', () => {
    for (const { layer, file } of modules()) {
      // constants.ts declares values and no behaviour. A test over it could only
      // restate the file, and would fail every time a name legitimately changes.
      if (file.endsWith('constants.ts')) continue;

      const test = path.join(SRC, 'tests', layer, `${path.basename(file, '.ts')}.test.ts`);

      assert.ok(fs.existsSync(test), `${path.relative(SRC, file)} has no test at ${path.relative(SRC, test)}`);
    }
  });
});
