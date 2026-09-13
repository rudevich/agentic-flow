import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { connectHint } from '../connect.js';
import { plain } from './helpers.js';

const SOURCES = [
  { name: 'jira', role: 'tracker', server: ['jira', 'atlassian'], auth: 'token' },
  { name: 'confluence', role: 'docs', server: ['confluence', 'atlassian'], auth: 'token' },
  { name: 'figma', role: 'design', server: ['figma'], auth: 'none' },
];

const text = (mapping) => plain(connectHint(SOURCES, mapping).join('\n'));

describe('connectHint', () => {
  it('says nothing when every role is filled', () => {
    assert.deepEqual(connectHint(SOURCES, { tracker: 'a', docs: 'a', design: 'figma' }), []);
  });

  it('names only the roles nothing fills', () => {
    const hint = text({ tracker: 'atlassian', docs: 'atlassian' });

    assert.match(hint, /no MCP server for: design/);
    assert.doesNotMatch(hint, /tracker/);
  });

  it('lists the server names that would fill the role', () => {
    assert.match(text({}), /tracker\s+<- jira, atlassian/);
  });

  it('points at the skill that declared it', () => {
    assert.match(text({}), /agentic\/skills\/confluence\/SKILL\.md/);
  });

  it('points at the command that picks a server up', () => {
    assert.match(text({}), /agentic-flow config/);
  });

  it('flags a source that takes no token', () => {
    const hint = text({ tracker: 'jira', docs: 'confluence' });

    assert.match(hint, /takes no token/);
  });

  it('does not flag one that does', () => {
    assert.doesNotMatch(text({ design: 'figma' }), /takes no token/);
  });

  it('explains a role invented by a source it has never seen', () => {
    const hint = plain(connectHint([{ name: 'notion', role: 'research', server: ['notion'], auth: 'token' }], {}).join('\n'));

    assert.match(hint, /no MCP server for: research/);
    assert.match(hint, /research\s+<- notion/);
  });
});
