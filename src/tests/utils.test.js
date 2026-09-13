import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { MIN_NODE_MAJOR } from '../constants.js';
import { packageRoot } from '../project.js';
import { TEMPLATES_DIR, fill, hash, nodeAtLeast, readJson, readTemplate } from '../utils.js';
import { tmpDir } from './helpers.js';

describe('nodeAtLeast', () => {
  it('compares the major version', () => {
    assert.equal(nodeAtLeast(24, '24.0.0'), true);
    assert.equal(nodeAtLeast(24, '25.1.0'), true);
    assert.equal(nodeAtLeast(24, '23.6.0'), false);
    assert.equal(nodeAtLeast(24, '18.20.4'), false);
  });

  it('reads the running version by default', () => {
    assert.equal(nodeAtLeast(Number.parseInt(process.versions.node, 10)), true);
  });

  // The package declares >=24; the constant the CLI checks must say the same.
  it('agrees with the engines field', () => {
    const { engines } = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    assert.equal(engines.node, `>=${MIN_NODE_MAJOR}`);
  });
});

describe('hash', () => {
  it('is stable for the same content', () => {
    assert.equal(hash('body'), hash('body'));
  });

  it('changes when the content changes', () => {
    assert.notEqual(hash('body'), hash('body '));
  });

  it('is short enough to read in a manifest', () => {
    assert.equal(hash('body').length, 16);
  });
});

describe('readJson', () => {
  it('parses a file', () => {
    const root = tmpDir();
    fs.writeFileSync(path.join(root, 'a.json'), '{"a":1}');

    assert.deepEqual(readJson(path.join(root, 'a.json')), { a: 1 });
  });

  it('is null for a file that is not there', () => {
    assert.equal(readJson(path.join(tmpDir(), 'nope.json')), null);
  });

  // A broken config belonging to another tool is not ours to fail on.
  it('is null for anything unparseable', () => {
    const root = tmpDir();
    fs.writeFileSync(path.join(root, 'a.json'), '<html>');

    assert.equal(readJson(path.join(root, 'a.json')), null);
  });

  it('is null for a directory', () => {
    assert.equal(readJson(tmpDir()), null);
  });
});

describe('readTemplate', () => {
  it('reads one of the package templates', () => {
    assert.match(readTemplate('AGENTS.md'), /\{\{PROJECT_NAME\}\}/);
  });

  it('joins the parts under the templates directory', () => {
    assert.equal(
      readTemplate('seed', 'skills', 'spec', 'SKILL.md'),
      fs.readFileSync(path.join(TEMPLATES_DIR, 'seed', 'skills', 'spec', 'SKILL.md'), 'utf8'),
    );
  });
});

describe('fill', () => {
  it('replaces every placeholder it is given a value for', () => {
    assert.equal(fill('{{A}} and {{B}}', { A: 'one', B: 'two' }), 'one and two');
  });

  it('replaces every occurrence, not just the first', () => {
    assert.equal(fill('{{A}} {{A}}', { A: 'x' }), 'x x');
  });

  it('leaves a placeholder it was given no value for', () => {
    assert.equal(fill('{{A}} {{B}}', { A: 'x' }), 'x {{B}}');
  });

  // `$&` and friends are substitution patterns to String.replaceAll. A source
  // name or URL fragment containing one must land in the file as written.
  it('treats a value containing $& as text', () => {
    assert.equal(fill('{{A}}', { A: 'a$&b' }), 'a$&b');
    assert.equal(fill('{{A}}', { A: '$1' }), '$1');
  });
});
