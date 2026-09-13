import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { LANGUAGE_MARKER } from '../constants.js';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  applyBlock,
  applyDocLanguage,
  languageBlock,
  languageLine,
  parseLang,
} from '../docs.js';
import { fakeReporter, opts, silenced, tmpDir } from './helpers.js';

const agentsWith = (body) => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), body);
  return root;
};

describe('parseLang', () => {
  it('takes a language by name or first letter', () => {
    assert.equal(parseLang('english'), 'english');
    assert.equal(parseLang(' E '), 'english');
    assert.equal(parseLang('request'), 'request');
    assert.equal(parseLang('r'), 'request');
  });

  it('is null when nobody asked for a language', () => {
    for (const value of [undefined, null, '']) assert.equal(parseLang(value), null);
  });

  it('warns instead of guessing at an unknown one', () => {
    const reporter = fakeReporter();

    assert.equal(parseLang('klingon', reporter), null);
    assert.ok(reporter.has('warnings', 'klingon'));
  });
});

describe('languageLine', () => {
  it('returns the sentence for each choice', () => {
    assert.equal(languageLine('english'), LANGUAGES.english);
    assert.equal(languageLine('request'), LANGUAGES.request);
  });

  it('defaults an unknown choice to English', () => {
    assert.equal(languageLine('klingon'), LANGUAGES[DEFAULT_LANGUAGE]);
  });
});

describe('applyBlock', () => {
  const page = ['# Title', '', '## Documents', '', LANGUAGE_MARKER, LANGUAGES.english, '', '## Next', '', 'tail'].join('\n');

  it('replaces only the block under the marker', async () => {
    const root = agentsWith(page);
    const reporter = fakeReporter();

    const { value } = await silenced(() =>
      applyBlock(root, LANGUAGE_MARKER, languageBlock('request'), opts(reporter)),
    );

    assert.equal(value, 'updated');
    const after = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').split('\n');
    assert.equal(after[5], LANGUAGES.request);
    assert.deepEqual(after.slice(6), ['', '## Next', '', 'tail']);
  });

  // The file already existed; only a block inside it changed. Reporting that as
  // a creation makes init count a re-scan as a first run.
  it('reports a rewritten block as an update, not a creation', async () => {
    const root = agentsWith(page);
    const reporter = fakeReporter();

    await silenced(() => applyBlock(root, LANGUAGE_MARKER, languageBlock('request'), opts(reporter)));

    assert.equal(reporter.counts.created, 0);
    assert.equal(reporter.counts.updated, 1);
  });

  it('replaces a multi-line block up to the blank line', async () => {
    const root = agentsWith(['<!-- m -->', 'one', 'two', '', 'after'].join('\n'));

    await silenced(() => applyBlock(root, '<!-- m -->', '<!-- m -->\nnew', opts(fakeReporter())));

    assert.equal(
      fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'),
      ['<!-- m -->', 'new', '', 'after'].join('\n'),
    );
  });

  it('says unchanged when the block already matches', async () => {
    const root = agentsWith(page);
    const reporter = fakeReporter();

    const { value } = await silenced(() => applyBlock(root, LANGUAGE_MARKER, languageBlock('english'), opts(reporter)));

    assert.equal(value, 'unchanged');
    assert.equal(reporter.counts.created, 0);
  });

  // A file the user wrote gets a suggestion, never a rewrite.
  it('leaves a file without the marker alone and prints the block', async () => {
    const root = agentsWith('# mine\n\nmy own rules\n');
    const before = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');

    const { value, output } = await silenced(() =>
      applyBlock(root, LANGUAGE_MARKER, languageBlock('english'), opts(fakeReporter())),
    );

    assert.equal(value, 'no-marker');
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), before);
    assert.ok(output.includes(LANGUAGE_MARKER));
  });

  it('reports no-file when AGENTS.md is absent', async () => {
    const { value } = await silenced(() => applyBlock(tmpDir(), LANGUAGE_MARKER, 'x', opts(fakeReporter())));
    assert.equal(value, 'no-file');
  });

  it('writes nothing on a dry run', async () => {
    const root = agentsWith(page);
    const before = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');

    await silenced(() => applyBlock(root, LANGUAGE_MARKER, languageBlock('request'), opts(fakeReporter(), { dryRun: true })));

    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), before);
  });
});

describe('applyDocLanguage', () => {
  it('swaps the language sentence in place', async () => {
    const root = agentsWith([LANGUAGE_MARKER, LANGUAGES.english, '', '## Next'].join('\n'));

    await silenced(() => applyDocLanguage(root, 'request', opts(fakeReporter())));

    assert.match(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /language the request was written in/);
  });
});
