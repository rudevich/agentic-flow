import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { BUILTIN_ROLES } from '../../constants.ts';
import { linksOnlyRoles, parseSource, readSources, rolesOf, sourceFor } from '../../model/sources.ts';
import { defined, fakeReporter, tmpProject } from '../helpers.ts';

const BLOCK = `
## Source

| Field | Value |
| --- | --- |
| role | docs |
| matches | notion.so, notion.site |
| writes | sources/analytics.md |
| server | notion |
| auth | token |
| links | follow |
`;

function skill(root: string, name: string, body: string): string {
  const dir = path.join(root, 'agentic', 'skills', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n${body}`);
  return dir;
}

describe('parseSource', () => {
  it('reads the declaration out of a skill', () => {
    const source = defined(parseSource(BLOCK));

    assert.equal(source.role, 'docs');
    assert.deepEqual(source.matches, ['notion.so', 'notion.site']);
    assert.equal(source.writes, 'sources/analytics.md');
    assert.deepEqual(source.server, ['notion']);
    assert.deepEqual(source.missing, []);
  });

  it('is null for a skill that is not a source', () => {
    assert.equal(parseSource('# Just a skill\n\nDo a thing.\n'), null);
  });

  it('defaults auth to token and links to follow', () => {
    const source = defined(parseSource('## Source\n\n| role | docs |\n| matches | a.b |\n| writes | s.md |\n'));

    assert.equal(source.auth, 'token');
    assert.equal(source.links, 'follow');
  });

  it('names the fields a broken block is missing', () => {
    const source = defined(parseSource('## Source\n\n| role | docs |\n'));

    assert.deepEqual(source.missing, ['matches', 'writes']);
  });

  it('stops at the next heading', () => {
    const source = defined(parseSource(`${BLOCK}\n## Other\n\n| role | design |\n`));

    assert.equal(source.role, 'docs');
  });

  it('strips backticks a writer may have added', () => {
    const source = defined(parseSource('## Source\n\n| role | `docs` |\n| matches | `a.b` |\n| writes | `s.md` |\n'));

    assert.equal(source.role, 'docs');
    assert.deepEqual(source.matches, ['a.b']);
  });

  it('reads a source unless it says fetch: no', () => {
    assert.equal(defined(parseSource(BLOCK)).fetch, 'yes');
    assert.equal(defined(parseSource(`${BLOCK}| fetch | no |\n`)).fetch, 'no');
    assert.equal(defined(parseSource(`${BLOCK}| fetch | \`NO\` |\n`)).fetch, 'no');
    assert.equal(defined(parseSource(`${BLOCK}| fetch | maybe |\n`)).fetch, 'yes');
  });
});

describe('readSources', () => {
  it('falls back to the seed skills while the project has none', () => {
    const names = readSources(tmpProject()).map(({ name }) => name);

    assert.deepEqual(names, ['confluence', 'figma', 'jira']);
  });

  it('uses only what the project declares once it declares anything', () => {
    const root = tmpProject();
    skill(root, 'notion', BLOCK);

    assert.deepEqual(readSources(root).map(({ name }) => name), ['notion']);
  });

  it('ignores skills with no declaration', () => {
    const root = tmpProject();
    skill(root, 'notion', BLOCK);
    skill(root, 'helper', '# Helper\n\nNot a source.\n');

    assert.deepEqual(readSources(root).map(({ name }) => name), ['notion']);
  });

  it('warns about a half-filled declaration instead of using it', () => {
    const root = tmpProject();
    skill(root, 'notion', BLOCK);
    skill(root, 'broken', '## Source\n\n| role | docs |\n');
    const reporter = fakeReporter();

    assert.deepEqual(readSources(root, { reporter }).map(({ name }) => name), ['notion']);
    assert.ok(reporter.has('warnings', 'broken'));
  });

  it('survives a skills directory that is not there', () => {
    assert.doesNotThrow(() => readSources(tmpProject()));
  });
});

describe('rolesOf', () => {
  it('keeps the built-in roles first and appends what was invented', () => {
    const roles = rolesOf([{ role: 'research' }, { role: 'docs' }, { role: 'metrics' }]);

    assert.deepEqual(roles, [...BUILTIN_ROLES, 'metrics', 'research']);
  });

  it('never repeats a role two sources share', () => {
    assert.deepEqual(rolesOf([{ role: 'docs' }, { role: 'docs' }]), BUILTIN_ROLES);
  });
});

describe('sourceFor', () => {
  const sources = readSources(tmpProject());

  it('routes a URL to the source that claims it', () => {
    assert.equal(sourceFor('https://co.atlassian.net/browse/PROJ-1', sources)?.name, 'jira');
    assert.equal(sourceFor('https://co.atlassian.net/wiki/spaces/X', sources)?.name, 'confluence');
    assert.equal(sourceFor('https://www.FIGMA.com/design/abc', sources)?.name, 'figma');
  });

  it('routes nothing it was not told about', () => {
    assert.equal(sourceFor('https://example.com/page', sources), undefined);
  });
});

describe('linksOnlyRoles', () => {
  const source = (role: string, fetch: 'yes' | 'no') => ({ role, fetch });

  it('names a role whose every source only lists its links', () => {
    assert.deepEqual([...linksOnlyRoles([source('design', 'no'), source('docs', 'yes')])], ['design']);
  });

  it('leaves out a role that one of its sources still reads', () => {
    assert.deepEqual([...linksOnlyRoles([source('docs', 'no'), source('docs', 'yes')])], []);
  });

  // The design is off until a project turns it on.
  it('finds the design switched off in the seed skills', () => {
    assert.deepEqual([...linksOnlyRoles(readSources(tmpProject()))], ['design']);
  });
});
