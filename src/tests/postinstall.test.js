import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { packageRoot } from '../project.js';
import { tmpProject } from './helpers.js';

/** postinstall reads its situation from the environment, so run it as npm would. */
function runPostinstall(env) {
  return execFileSync(process.execPath, [path.join(packageRoot, 'src', 'postinstall.js')], {
    encoding: 'utf8',
    env: { ...process.env, INIT_CWD: '', npm_config_global: '', ...env },
  });
}

describe('postinstall', () => {
  it('points at the command to run', () => {
    const output = runPostinstall({ INIT_CWD: tmpProject() });
    assert.match(output, /npx agentic-flow init/);
  });

  it('leaves the host package.json untouched', () => {
    const root = tmpProject();
    const before = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

    runPostinstall({ INIT_CWD: root });

    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), before);
  });

  it('says nothing when npm gave it no INIT_CWD', () => {
    assert.equal(runPostinstall({ INIT_CWD: '' }).trim(), '');
  });

  it('says nothing on a global install', () => {
    assert.equal(runPostinstall({ INIT_CWD: tmpProject(), npm_config_global: 'true' }).trim(), '');
  });

  // `npm install` inside this repository is not an install into a host project.
  it('says nothing when run inside the package itself', () => {
    assert.equal(runPostinstall({ INIT_CWD: packageRoot }).trim(), '');
  });

  it('exits 0 even when the host package.json is unreadable', () => {
    const root = tmpProject();
    fs.writeFileSync(path.join(root, 'package.json'), '{ broken');

    // execFileSync throws on a non-zero exit; reaching the assert means it did not.
    const output = runPostinstall({ INIT_CWD: root });
    assert.equal(typeof output, 'string');
  });
});
