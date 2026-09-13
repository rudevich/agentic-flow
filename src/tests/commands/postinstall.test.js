import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { MANIFEST_PATH } from '../../constants.js';
import { ownPackage, packageRoot } from '../../project.js';
import { tmpProject, writeJson } from '../helpers.js';

const escaped = (version) => version.replace(/\./g, '\\.');

function writeManifest(root, extra) {
  writeJson(path.join(root, MANIFEST_PATH), { version: 1, entries: [], ...extra });
}

/** postinstall reads its situation from the environment, so run it as npm would. */
function runPostinstall(env) {
  return execFileSync(process.execPath, [path.join(packageRoot, 'src', 'commands', 'postinstall.js')], {
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

  // A manifest in the project means it was scaffolded before, so this install
  // is an upgrade, and "run init to scaffold" would be the wrong thing to say.
  it('says it updated, and from which version, when the project has a manifest', () => {
    const root = tmpProject();
    writeManifest(root, { packageVersion: '0.0.1' });

    const output = runPostinstall({ INIT_CWD: root });

    assert.match(output, new RegExp(`updated 0\\.0\\.1 -> ${escaped(ownPackage().version)}`));
    assert.match(output, /npx agentic-flow init/);
  });

  it('still says it updated when the manifest predates the version field', () => {
    const root = tmpProject();
    writeManifest(root, {});

    const output = runPostinstall({ INIT_CWD: root });

    assert.match(output, new RegExp(`updated to ${escaped(ownPackage().version)}`));
    assert.doesNotMatch(output, /undefined|null/);
  });

  // Reinstalling the same version is not an upgrade, and "0.1.6 -> 0.1.6" reads
  // like a bug.
  it('does not claim an upgrade when the version did not move', () => {
    const root = tmpProject();
    writeManifest(root, { packageVersion: ownPackage().version });

    const output = runPostinstall({ INIT_CWD: root });

    assert.match(output, new RegExp(`reinstalled ${escaped(ownPackage().version)}`));
    assert.doesNotMatch(output, /->/);
  });

  it('says it installed when there is no manifest', () => {
    assert.match(runPostinstall({ INIT_CWD: tmpProject() }), /installed/);
  });

  it('exits 0 even when the host package.json is unreadable', () => {
    const root = tmpProject();
    fs.writeFileSync(path.join(root, 'package.json'), '{ broken');

    // execFileSync throws on a non-zero exit; reaching the assert means it did not.
    const output = runPostinstall({ INIT_CWD: root });
    assert.equal(typeof output, 'string');
  });
});
