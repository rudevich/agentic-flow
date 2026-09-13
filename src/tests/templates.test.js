import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parseSource } from '../model/sources.js';
import { TEMPLATES_DIR } from '../utils.js';

/**
 * These files are instructions a model executes, sometimes a weak one, and they
 * ship to every project. The checks below are the contract described in
 * AGENTS.md: the gaps a weak model fills by guessing, closed and kept closed.
 */

const TIME_RULE = 'Use the current date and time. Do not copy the example.';
const PLACEHOLDER_RULE = 'Replace every `<…>` with a real value.';

const SEED_SKILLS = path.join(TEMPLATES_DIR, 'seed', 'skills');
const SEED_AGENTS = path.join(TEMPLATES_DIR, 'seed', 'agents');

const read = (file) => fs.readFileSync(file, 'utf8');
const skillFile = (name) => path.join(SEED_SKILLS, name, 'SKILL.md');

const SOURCE_SKILLS = ['jira', 'confluence', 'figma'];
const ROUTER_SKILLS = ['spec', 'plan'];
const AGENTS = ['specificator', 'planner'];

/** Every shipped document a model reads, by path. */
function everyDocument() {
  const docs = [path.join(TEMPLATES_DIR, 'source.SKILL.md'), path.join(TEMPLATES_DIR, 'AGENTS.md')];
  for (const name of fs.readdirSync(SEED_SKILLS)) docs.push(skillFile(name));
  for (const name of fs.readdirSync(SEED_AGENTS)) docs.push(path.join(SEED_AGENTS, name));
  for (const name of fs.readdirSync(TEMPLATES_DIR)) {
    if (name.endsWith('.README.md')) docs.push(path.join(TEMPLATES_DIR, name));
  }
  return docs;
}

/** Headings outside fenced blocks. A `## Goal` inside an output template is not a section. */
function sections(content) {
  const found = [];
  let fenced = false;

  for (const line of content.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    if (!fenced && line.startsWith('## ')) found.push(line.slice(3).trim());
  }

  return found;
}

/**
 * The sentences a reader actually reads. Fences, tables, headings and
 * frontmatter are not prose. A list item is its own unit: three bullets in a row
 * are three short lines, not one long sentence, and measuring them joined is how
 * you end up "fixing" text that was already fine.
 */
function sentences(content) {
  const blocks = [];
  let current = [];
  let fenced = false;
  let front = false;

  const flush = () => {
    if (current.length) blocks.push(current.join(' '));
    current = [];
  };

  content.split('\n').forEach((line, i) => {
    if (i === 0 && line.trim() === '---') { front = true; return; }
    if (front) { if (line.trim() === '---') front = false; return; }
    if (line.trimStart().startsWith('```')) { fenced = !fenced; flush(); return; }
    if (fenced) return;

    const text = line.trim();
    if (!text || text.startsWith('|') || text.startsWith('#') || text.startsWith('>')) { flush(); return; }
    // A new list item starts a new unit; its wrapped continuation lines do not.
    if (/^[-*]\s|^\d+\.\s/.test(text)) flush();
    current.push(text.replace(/^[-*]\s+|^\d+\.\s+/, ''));
  });

  flush();

  return blocks
    // `**N3 — say it.** Then this.` is two sentences: the bold run carries the
    // full stop inside it, so the split has to look past the closing asterisks.
    .flatMap((block) => block.split(/(?<=[.:;?]\**)\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One checklist item, continuation lines folded in. */
function checklistItems(section) {
  const items = [];

  for (const line of section.split('\n')) {
    const text = line.trim();
    if (text.startsWith('- [ ]')) items.push(text);
    else if (items.length && text && !text.startsWith('#')) items[items.length - 1] += ` ${text}`;
    else if (text.startsWith('#')) break;
  }

  return items;
}

describe('every shipped document', () => {
  it('replaces its example timestamp with a rule, or shows none', () => {
    for (const file of everyDocument()) {
      const content = read(file);
      if (!/\d{4}-\d{2}-\d{2}/.test(content)) continue;

      assert.ok(
        content.includes(TIME_RULE),
        `${path.relative(TEMPLATES_DIR, file)} shows a date but never says to use the current one`,
      );
    }
  });

  it('explains its placeholders wherever it uses them', () => {
    for (const file of everyDocument()) {
      const content = read(file);
      // Templates the package fills in itself, like {{PROJECT_NAME}}, are not
      // placeholders for the model to replace.
      const inFence = content.split('```').filter((_, i) => i % 2 === 1).join('\n');
      if (!/<[a-z][a-z ]+>/.test(inFence)) continue;

      assert.ok(
        content.includes(PLACEHOLDER_RULE),
        `${path.relative(TEMPLATES_DIR, file)} uses <placeholders> but never says to replace them`,
      );
    }
  });

  it('never tells the model to "load" another skill', () => {
    for (const file of everyDocument()) {
      assert.doesNotMatch(
        read(file),
        /\bload (the )?[`a-z]+ skill/i,
        `${path.relative(TEMPLATES_DIR, file)} says "load" where it means a tool call`,
      );
    }
  });

  it('keeps every sentence under 26 words outside fences and tables', () => {
    for (const file of everyDocument()) {
      const long = sentences(read(file)).filter((s) => s.split(/\s+/).length > 25);

      assert.deepEqual(long, [], `${path.relative(TEMPLATES_DIR, file)} has a sentence over 25 words`);
    }
  });

  it('ships no half-written instruction', () => {
    for (const file of everyDocument()) {
      // source.SKILL.md is the skeleton a user fills in, so its TODOs are the point.
      if (file.endsWith('source.SKILL.md')) continue;

      assert.doesNotMatch(read(file), /TODO/, `${path.relative(TEMPLATES_DIR, file)} still has a TODO`);
    }
  });
});

describe('a source skill', () => {
  const REQUIRED = [
    'Which URLs are yours',
    'Which tool to use',
    'What to copy',
    'What to write',
    'What to report back',
    /^If you cannot read/,
    'Source',
  ];

  const files = [...SOURCE_SKILLS.map(skillFile), path.join(TEMPLATES_DIR, 'source.SKILL.md')];

  it('carries the seven sections, in order', () => {
    for (const file of files) {
      const found = sections(read(file));

      assert.equal(found.length, REQUIRED.length, `${path.basename(path.dirname(file))}: ${found.join(' / ')}`);
      found.forEach((heading, i) => {
        const want = REQUIRED[i];
        if (want instanceof RegExp) assert.match(heading, want);
        else assert.equal(heading, want);
      });
    }
  });

  it('declares itself with all six fields', () => {
    for (const file of files) {
      const declared = parseSource(read(file));

      assert.ok(declared, `${file} has no ## Source table`);
      assert.deepEqual(declared.missing, []);
      for (const field of ['server', 'auth', 'links']) {
        assert.ok(declared[field]?.length, `${file} declares no ${field}`);
      }
    }
  });

  // spec reads this answer. A skill that invents its own shape breaks the router.
  it('states the answer spec expects', () => {
    for (const file of files) {
      const content = read(file);

      assert.match(content, /written:/, `${file} never shows the written: line`);
      assert.match(content, /links:/, `${file} never shows the links: line`);
    }
  });

  it('names itself the way its directory is named', () => {
    for (const name of SOURCE_SKILLS) {
      assert.match(read(skillFile(name)), new RegExp(`^name: ${name}$`, 'm'));
    }
  });
});

describe('a router skill', () => {
  it('ends with a checklist whose lines point at a step or a rule', () => {
    for (const name of ROUTER_SKILLS) {
      const content = read(skillFile(name));
      const checklist = content.split('## Before you finish')[1];

      assert.ok(checklist, `${name} has no Before you finish section`);
      const boxes = checklistItems(checklist);
      assert.ok(boxes.length >= 5, `${name} has only ${boxes.length} checklist lines`);

      const anchored = boxes.filter((line) => /\((step \d|N\d)/.test(line) || /\bN\d\b/.test(line));
      assert.ok(anchored.length >= boxes.length - 1, `${name}: checklist lines name no step or rule`);
    }
  });

  it('numbers its content rules so the checklist can cite them', () => {
    for (const name of ROUTER_SKILLS) {
      const content = read(skillFile(name));

      assert.match(content, /### Rules for the content/, `${name} has no numbered rules`);
      assert.match(content, /- \*\*N1 —/, `${name} does not number its rules`);
    }
  });

  it('shows its output template before the checklist, not after', () => {
    for (const name of ROUTER_SKILLS) {
      const content = read(skillFile(name));

      assert.ok(
        content.indexOf('```markdown') < content.indexOf('## Before you finish'),
        `${name} keeps its template after the checklist, so the reader has to jump forward`,
      );
      assert.doesNotMatch(content, /template at the end of this file/);
    }
  });
});

describe('an agent', () => {
  it('says which skill to call, as a tool call', () => {
    for (const name of AGENTS) {
      const content = read(path.join(SEED_AGENTS, `${name}.md`));

      assert.match(content, /## What you must do/, `${name} never says what to do first`);
      assert.match(content, /Skill tool/, `${name} does not say how to call a skill`);
    }
  });

  it('keeps the tools line where init rewrites it', () => {
    // applyToolsLine replaces /^tools:.*$/m, and the specificator's line is the
    // generated one. Moving it out of the frontmatter would break that.
    const lines = read(path.join(SEED_AGENTS, 'specificator.md')).split('\n');
    assert.equal(lines[3], '{{MCP_TOOLS}}');
    assert.match(read(path.join(SEED_AGENTS, 'planner.md')), /^tools: /m);
  });
});
