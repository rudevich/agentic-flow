import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { init } from '../../commands/init.js';
import { reset } from '../../commands/reset.js';
import { MANIFEST_PATH } from '../../constants.js';
import { readManifest } from '../../model/manifest.js';
import { silenced, tmpProject } from '../helpers.js';

const scaffold = async () => {
  const root = tmpProject();
  await silenced(() => init({ cwd: root, yes: true }));
  return root;
};

const run = (root, options = {}) => silenced(() => reset({ cwd: root, yes: true, ...options }));

describe('reset', () => {
  it('takes the scaffold back out', async () => {
    const root = await scaffold();
    await run(root);

    for (const entry of ['AGENTS.md', 'CLAUDE.md', '.claude', 'agentic']) {
      assert.equal(fs.existsSync(path.join(root, entry)), false, entry);
    }
  });

  it('leaves the project exactly as it found it', async () => {
    const root = tmpProject();
    const before = fs.readdirSync(root).sort();

    await silenced(() => init({ cwd: root, yes: true }));
    await run(root);

    assert.deepEqual(fs.readdirSync(root).sort(), before);
  });

  // Manifest-driven: files the user wrote are invisible to reset.
  it('keeps skills and tasks the user added', async () => {
    const root = await scaffold();
    fs.mkdirSync(path.join(root, 'agentic', 'skills', 'mine'), { recursive: true });
    fs.writeFileSync(path.join(root, 'agentic', 'skills', 'mine', 'SKILL.md'), 'mine');
    fs.mkdirSync(path.join(root, 'agentic', 'tasks', 'PROJ-1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'agentic', 'tasks', 'PROJ-1', 'requirements.md'), 'reqs');

    await run(root);

    assert.equal(fs.readFileSync(path.join(root, 'agentic', 'skills', 'mine', 'SKILL.md'), 'utf8'), 'mine');
    assert.equal(fs.readFileSync(path.join(root, 'agentic', 'tasks', 'PROJ-1', 'requirements.md'), 'utf8'), 'reqs');
  });

  it('unlinks .claude without following it into agentic/', async () => {
    const root = await scaffold();
    fs.mkdirSync(path.join(root, 'agentic', 'tasks', 'T-1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'agentic', 'tasks', 'T-1', 'requirements.md'), 'keep');

    await run(root);

    assert.equal(fs.existsSync(path.join(root, '.claude')), false);
    assert.equal(fs.readFileSync(path.join(root, 'agentic', 'tasks', 'T-1', 'requirements.md'), 'utf8'), 'keep');
  });

  it('keeps a file changed since init, and reports it', async () => {
    const root = await scaffold();
    fs.appendFileSync(path.join(root, 'AGENTS.md'), '\nmy own note\n');

    const { value } = await run(root);

    assert.equal(value.kept, 1);
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
  });

  // A repointed symlink is the user's change, the same as an edited file.
  it('keeps a symlink the user repointed elsewhere', async () => {
    const root = await scaffold();
    const link = path.join(root, '.claude');
    fs.unlinkSync(link);
    fs.symlinkSync('somewhere-else', link);

    const { output } = await run(root);

    assert.equal(fs.readlinkSync(link), 'somewhere-else');
    assert.match(output, /repointed/);
  });

  it('removes a repointed symlink when forced', async () => {
    const root = await scaffold();
    const link = path.join(root, '.claude');
    fs.unlinkSync(link);
    fs.symlinkSync('somewhere-else', link);

    await run(root, { force: true });

    assert.equal(fs.existsSync(link), false);
  });

  it('removes a changed file when forced', async () => {
    const root = await scaffold();
    fs.appendFileSync(path.join(root, 'AGENTS.md'), '\nmy own note\n');

    await run(root);
    await run(root, { force: true });

    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  });

  // A partial reset must leave a manifest, or --force would have nothing to act on.
  it('shrinks the manifest to the kept files instead of deleting it', async () => {
    const root = await scaffold();
    fs.appendFileSync(path.join(root, 'AGENTS.md'), '\nedited\n');

    await run(root);

    const entries = readManifest(root).entries.filter((e) => e.type === 'file');
    assert.deepEqual(entries.map((e) => e.path), ['AGENTS.md']);
  });

  it('removes the manifest when nothing was kept', async () => {
    const root = await scaffold();
    await run(root);

    assert.equal(fs.existsSync(path.join(root, MANIFEST_PATH)), false);
  });

  it('does nothing without a manifest', async () => {
    const root = tmpProject();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'not ours');

    const { value } = await run(root);

    assert.equal(value.removed, 0);
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
  });

  it('deletes nothing on a dry run', async () => {
    const root = await scaffold();
    const { value } = await run(root, { dryRun: true });

    assert.equal(value.removed, 0);
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
  });

  it('refuses to delete without a confirmation when there is no TTY', async () => {
    const root = await scaffold();
    const { value } = await run(root, { yes: false });

    assert.equal(value.removed, 0);
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
  });

  it('takes agentic/ wholesale only with --all', async () => {
    const root = await scaffold();
    fs.mkdirSync(path.join(root, 'agentic', 'skills', 'mine'), { recursive: true });
    fs.writeFileSync(path.join(root, 'agentic', 'skills', 'mine', 'SKILL.md'), 'mine');

    await run(root, { all: true });

    assert.equal(fs.existsSync(path.join(root, 'agentic')), false);
  });

  it('keeps .env.agentic unless asked for it', async () => {
    const root = await scaffold();
    fs.writeFileSync(path.join(root, '.env.agentic'), 'JIRA_TOKEN=x\n', { mode: 0o600 });

    await run(root);
    assert.ok(fs.existsSync(path.join(root, '.env.agentic')), 'a token cannot be recovered');
  });

  it('removes .env.agentic with --secrets', async () => {
    const root = await scaffold();
    fs.writeFileSync(path.join(root, '.env.agentic'), 'JIRA_TOKEN=x\n', { mode: 0o600 });

    await run(root, { secrets: true });
    assert.equal(fs.existsSync(path.join(root, '.env.agentic')), false);
  });
});
