import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { init } from '../../commands/init.ts';
import { readManifest } from '../../model/manifest.ts';
import { addSource } from '../../commands/source.ts';
import { readSources } from '../../model/sources.ts';
import { defined, silenced, tmpProject } from '../helpers.ts';

// node --test gives us no TTY, so both commands take their non-interactive path.
const scaffold = (cwd: string) => silenced(() => init({ cwd }));
const add = (cwd: string, name: string, options: Parameters<typeof addSource>[0] = {}) =>
  silenced(() => addSource({ cwd, name, matches: 'notion.so', role: 'docs', auth: 'none', ...options }));

const skillOf = (root: string, name: string) => path.join(root, 'agentic', 'skills', name, 'SKILL.md');

describe('source add', () => {
  it('writes a skill that declares itself', async () => {
    const root = tmpProject();
    await scaffold(root);
    await add(root, 'notion', { role: 'research', matches: 'notion.so, notion.site' });

    const declared = defined(readSources(root).find(({ name }) => name === 'notion'));
    assert.equal(declared.role, 'research');
    assert.deepEqual(declared.matches, ['notion.so', 'notion.site']);
    assert.equal(declared.writes, 'sources/notion');
    assert.equal(declared.auth, 'none');
  });

  it('leaves no placeholder in the skill it writes', async () => {
    const root = tmpProject();
    await scaffold(root);
    await add(root, 'notion');

    assert.doesNotMatch(fs.readFileSync(skillOf(root, 'notion'), 'utf8'), /\{\{/);
  });

  it('puts an invented role into the AGENTS.md table', async () => {
    const root = tmpProject();
    await scaffold(root);
    await add(root, 'notion', { role: 'research' });

    assert.match(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /\| research \|/);
  });

  it('writes nothing outside the skill it was asked for', async () => {
    const root = tmpProject();
    await scaffold(root);
    const before = fs.readdirSync(root).sort();

    await add(root, 'notion', { auth: 'token' });

    assert.deepEqual(fs.readdirSync(root).sort(), before);
  });

  it('says how to connect the server its new source needs', async () => {
    const root = tmpProject();
    await scaffold(root);
    const { output } = await add(root, 'notion', { role: 'research' });

    assert.match(output, /no MCP server for: research/);
    assert.doesNotMatch(output, /tracker/);
  });

  it('refuses a name that is not a name', async () => {
    const root = tmpProject();
    await scaffold(root);
    const { value } = await add(root, 'Not A Name');

    assert.equal(value.warnings, 1);
    assert.equal(fs.existsSync(path.join(root, 'agentic', 'skills', 'Not A Name')), false);
  });

  it('refuses to write over a skill that already exists', async () => {
    const root = tmpProject();
    await scaffold(root);
    const before = fs.readFileSync(skillOf(root, 'jira'), 'utf8');

    const { value } = await add(root, 'jira');

    assert.equal(value.warnings, 1);
    assert.equal(fs.readFileSync(skillOf(root, 'jira'), 'utf8'), before);
  });

  it('writes nothing on a dry run', async () => {
    const root = tmpProject();
    await scaffold(root);
    await add(root, 'notion', { dryRun: true });

    assert.equal(fs.existsSync(skillOf(root, 'notion')), false);
  });

  it('keeps the manifest init wrote, and stays out of it itself', async () => {
    const root = tmpProject();
    await scaffold(root);
    const before = defined(readManifest(root)).entries.length;

    await add(root, 'notion');

    const entries = defined(readManifest(root)).entries;
    assert.ok(entries.length >= before, 'init entries survived');
    assert.ok(entries.some((e) => e.path.endsWith(path.join('skills', 'spec', 'SKILL.md'))));
    assert.equal(entries.some((e) => e.path.includes('notion')), false);
  });

  it('does not need a source name it was never given', async () => {
    const root = tmpProject();
    await scaffold(root);
    const { value } = await add(root, 'notion', { matches: undefined });

    assert.equal(value.warnings, 1);
    assert.equal(fs.existsSync(skillOf(root, 'notion')), false);
  });
});
