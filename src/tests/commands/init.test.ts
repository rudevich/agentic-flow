import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { config, init } from '../../commands/init.ts';
import { MANIFEST_PATH, MCP_OUTPUT_TOKENS, ROLES_MARKER } from '../../constants.ts';
import { readManifest, recordedHash } from '../../model/manifest.ts';
import { hash } from '../../utils.ts';
import { ownPackage } from '../../project.ts';
import { addSource } from '../../commands/source.ts';
import { defined, fileEntry, silenced, tmpProject, writeJson } from '../helpers.ts';

const run = (cwd: string, options: Parameters<typeof init>[0] = {}) => silenced(() => init({ cwd, ...options }));
const read = (root: string, ...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('init', () => {
  it('lays out the whole scaffold', async () => {
    const root = tmpProject();
    await run(root);

    for (const dir of ['skills', 'agents', 'hooks', 'tasks']) {
      assert.ok(fs.statSync(path.join(root, 'agentic', dir)).isDirectory(), dir);
    }
    for (const skill of ['spec', 'plan', 'design', 'jira', 'confluence', 'figma']) {
      assert.ok(fs.existsSync(path.join(root, 'agentic', 'skills', skill, 'SKILL.md')), skill);
    }
    assert.ok(fs.existsSync(path.join(root, 'agentic', 'agents', 'specificator.md')));
    assert.ok(fs.existsSync(path.join(root, 'agentic', 'agents', 'reader.md')));
    assert.ok(fs.existsSync(path.join(root, 'agentic', 'agents', 'part-reader.md')));
    assert.ok(fs.existsSync(path.join(root, 'agentic', 'agents', 'designer.md')));
    assert.ok(fs.existsSync(path.join(root, 'agentic', 'settings.json')));
    assert.ok(fs.existsSync(path.join(root, 'agentic', 'agents', 'planner.md')));
  });

  it('links .claude and CLAUDE.md at what they should point to', async () => {
    const root = tmpProject();
    await run(root);

    assert.equal(fs.readlinkSync(path.join(root, '.claude')), 'agentic');
    assert.equal(fs.readlinkSync(path.join(root, 'CLAUDE.md')), 'AGENTS.md');
    assert.ok(fs.existsSync(path.join(root, '.claude', 'skills', 'spec', 'SKILL.md')));
  });

  it('names the project in AGENTS.md and leaves no placeholder behind', async () => {
    const root = tmpProject('my-app');
    await run(root);

    const agents = read(root, 'AGENTS.md');
    assert.match(agents, /^# my-app/);
    assert.doesNotMatch(agents, /\{\{/);
  });

  it('writes documents in the language of the request unless told otherwise', async () => {
    const root = tmpProject();
    await run(root);

    assert.match(read(root, 'AGENTS.md'), /in the language the request was written in/);
  });

  it('takes the language from --lang', async () => {
    const root = tmpProject();
    await run(root, { lang: 'english' });

    assert.match(read(root, 'AGENTS.md'), /generate in English, whatever the language/);
  });

  it('leaves a language already chosen alone without --lang', async () => {
    const root = tmpProject();
    await run(root, { lang: 'english' });
    await run(root);

    assert.match(read(root, 'AGENTS.md'), /generate in English, whatever the language/);
  });

  it('asks for nothing and writes no access files', async () => {
    const root = tmpProject();
    await run(root);

    for (const file of ['.mcp.json', '.env.agentic', '.env.agentic.example']) {
      assert.equal(fs.existsSync(path.join(root, file)), false, file);
    }
    assert.equal(fs.existsSync(path.join(root, '.gitignore')), false);
  });

  it('ends with the three things to do next', async () => {
    const root = tmpProject();
    const { output } = await run(root);

    assert.match(output, /describe the project in AGENTS\.md/);
    assert.match(output, /npx @rudevich\/agentic-flow config/);
    assert.match(output, /\/spec <ticket-url>/);
  });

  it('does not repeat them once the project is scaffolded', async () => {
    const root = tmpProject();
    await run(root);
    const { output } = await run(root);

    assert.doesNotMatch(output, /describe the project in AGENTS\.md/);
  });

  // Rewriting a block inside AGENTS.md is not creating anything, and a project
  // that has been scaffolded for months should not be told to start it.
  it('does not call a rewritten roles table a first run', async () => {
    const root = tmpProject();
    await run(root);
    const stale = read(root, 'AGENTS.md').replace(/\| tracker \|[^\n]*\n/, '| tracker | `gone` |\n');
    fs.writeFileSync(path.join(root, 'AGENTS.md'), stale);

    const { value, output } = await run(root);

    assert.equal(value.created, 0);
    assert.equal(value.updated, 1);
    assert.doesNotMatch(output, /describe the project in AGENTS\.md/);
    assert.match(output, /restart your Claude session/);
  });

  // Every path this tool writes runs through agentic/. A file standing there
  // used to take the whole run down with a raw ENOTDIR.
  it('stops with a warning when agentic/ is a file', async () => {
    const root = tmpProject();
    fs.writeFileSync(path.join(root, 'agentic'), 'not a directory\n');

    const { value, output } = await run(root);

    assert.match(output, /agentic\/ exists but is not a directory/);
    assert.equal(value.created, 0);
    // nothing was written beside it either
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.equal(read(root, 'agentic'), 'not a directory\n');
  });

  it('crashes on nothing when a managed file turned into a directory', async () => {
    const root = tmpProject();
    await run(root);
    const skill = path.join(root, 'agentic', 'skills', 'spec', 'SKILL.md');
    fs.rmSync(skill);
    fs.mkdirSync(skill);

    const { value, output } = await run(root);

    assert.match(output, /not a regular file/);
    assert.ok(value.warnings >= 1);
    // and the rest of the run still happened
    assert.match(output, /agentic\/skills\/plan\/SKILL\.md/);
  });

  it('says loudly that an existing .claude directory blocks everything', async () => {
    const root = tmpProject();
    fs.mkdirSync(path.join(root, '.claude'));
    fs.writeFileSync(path.join(root, '.claude', 'settings.local.json'), '{}\n');

    const { output } = await run(root);

    assert.match(output, /\.claude is a real directory/);
    assert.match(output, /\/spec does not exist/);
    assert.match(output, /ln -s \.\.\/agentic\/skills \.claude\/skills/);
    // and it is still the user's directory afterwards
    assert.equal(fs.readFileSync(path.join(root, '.claude', 'settings.local.json'), 'utf8'), '{}\n');
    assert.equal(defined(readManifest(root)).entries.some((e) => e.path === '.claude'), false);
  });

  it('keeps saying it on a run that creates nothing', async () => {
    const root = tmpProject();
    fs.mkdirSync(path.join(root, '.claude'));
    await run(root);

    const { value, output } = await run(root);

    assert.equal(value.created, 0);
    assert.match(output, /\.claude is a real directory/);
  });

  it('says it during a dry run too, before anything is written', async () => {
    const root = tmpProject();
    fs.mkdirSync(path.join(root, '.claude'));

    const { output } = await run(root, { dryRun: true });

    assert.match(output, /\.claude is a real directory/);
    assert.equal(fs.existsSync(path.join(root, 'agentic')), false);
  });

  it('tells a plain file apart from a directory', async () => {
    const root = tmpProject();
    fs.writeFileSync(path.join(root, '.claude'), 'not a directory\n');

    const { output } = await run(root);

    assert.match(output, /\.claude is a real file/);
    assert.match(output, /rm \.claude/);
  });

  it('offers --force when .claude points somewhere else', async () => {
    const root = tmpProject();
    fs.symlinkSync('elsewhere', path.join(root, '.claude'));

    const { output } = await run(root);

    assert.match(output, /\.claude is a symlink to elsewhere/);
    assert.match(output, /init --force/);
  });

  it('says none of that when the link is fine', async () => {
    const root = tmpProject();
    const { output } = await run(root);

    assert.doesNotMatch(output, /does not exist/);
    assert.doesNotMatch(output, /ln -s/);
  });

  it('says how to connect a role nothing fills', async () => {
    const root = tmpProject();
    const { output } = await run(root);

    assert.match(output, /no MCP server for:/);
    assert.match(output, /agentic-flow config/);
    assert.match(output, /agentic\/skills\/jira\/SKILL\.md/);
  });

  it('is idempotent — a second run creates nothing', async () => {
    const root = tmpProject();
    await run(root);
    const before = read(root, 'AGENTS.md');

    const { value } = await run(root);

    assert.equal(value.created, 0);
    assert.equal(read(root, 'AGENTS.md'), before);
  });

  it('never overwrites an AGENTS.md the user already had', async () => {
    const root = tmpProject();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# mine\n');

    await run(root);
    assert.equal(read(root, 'AGENTS.md'), '# mine\n');
  });

  it('records what it created in the manifest', async () => {
    const root = tmpProject();
    await run(root);

    const paths = defined(readManifest(root)).entries.map((e) => e.path);
    assert.ok(paths.includes('AGENTS.md'));
    assert.ok(paths.includes('.claude'));
    assert.ok(paths.includes(path.join('agentic', 'skills', 'spec', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(root, MANIFEST_PATH)));
  });

  it('writes no .mcp.json when it was told nothing', async () => {
    const root = tmpProject();
    await run(root);

    assert.equal(fs.existsSync(path.join(root, '.mcp.json')), false);
  });

  it('changes nothing on disk during a dry run', async () => {
    const root = tmpProject();
    const before = fs.readdirSync(root);

    await run(root, { dryRun: true });

    assert.deepEqual(fs.readdirSync(root), before);
  });
});

describe('init and detected MCP servers', () => {
  // A project .mcp.json is one of the sources detectServers reads.
  const withServers = (servers: Record<string, unknown>) => {
    const root = tmpProject();
    writeJson(path.join(root, '.mcp.json'), { mcpServers: servers });
    return root;
  };

  it('fills the roles table from what it found', async () => {
    const root = withServers({ atlassian: { url: 'https://a/mcp' } });
    await run(root);

    const block = read(root, 'AGENTS.md').split(ROLES_MARKER)[1] ?? '';
    assert.match(block, /\| tracker \| `atlassian` \|/);
    assert.match(block, /\| docs \| `atlassian` \|/);
    assert.match(block, /\| design \| — \(links only\) \|/);
  });

  it('picks up a source skill the project added, with the role it invented', async () => {
    const root = tmpProject();
    await run(root);

    const dir = path.join(root, 'agentic', 'skills', 'notion');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'SKILL.md'),
      '---\nname: notion\n---\n\n## Source\n\n| role | research |\n| matches | notion.so |\n| writes | sources/notion.md |\n| server | notion |\n',
    );
    writeJson(path.join(root, '.mcp.json'), { mcpServers: { notion: { url: 'https://notion.example/mcp' } } });

    await run(root);

    assert.match(read(root, 'AGENTS.md'), /\| research \| `notion` \|/);
    assert.match(read(root, 'agentic', 'agents', 'reader.md'), /^tools:.*mcp__notion/m);
  });

  it("puts the detected servers into the reader's allowlist", async () => {
    const root = withServers({ jira: { url: 'x' }, figma: { url: 'y' } });
    await run(root);

    const tools = read(root, 'agentic', 'agents', 'reader.md').match(/^tools:.*$/m)?.[0] ?? '';
    assert.ok(tools.includes('mcp__jira'));
    assert.ok(!tools.includes('mcp__figma'), 'figma only lists its links, so the reader needs no figma tools');
    assert.doesNotMatch(tools, /\bEdit\b|\bBash\b/);
  });

  // The designer reads designs after the specification, so it keeps the design
  // role the reader gave up.
  it('gives the designer the server the reader does not get', async () => {
    const root = withServers({ jira: { url: 'x' }, figma: { url: 'y' } });
    await run(root);

    const designer = read(root, 'agentic', 'agents', 'designer.md').match(/^tools:.*$/m)?.[0] ?? '';
    assert.ok(designer.includes('mcp__figma'), designer);
    assert.doesNotMatch(designer, /mcp__jira/);
    assert.doesNotMatch(read(root, 'agentic', 'agents', 'reader.md'), /mcp__figma/);
  });

  it('asks for no design server while figma only lists its links', async () => {
    const root = withServers({ jira: { url: 'x' }, confluence: { url: 'y' } });
    const { output } = await run(root);

    assert.doesNotMatch(output, /no MCP server for/);
    assert.match(read(root, 'AGENTS.md'), /\| design \| — \(links only\) \|/);
  });

  it('gives the reader the figma tools back once figma says fetch: yes', async () => {
    const root = withServers({ jira: { url: 'x' }, figma: { url: 'y' } });
    await run(root);
    const skill = path.join(root, 'agentic', 'skills', 'figma', 'SKILL.md');
    fs.writeFileSync(skill, fs.readFileSync(skill, 'utf8').replace('| fetch | no |', '| fetch | yes |'));

    await silenced(() => config({ cwd: root }));

    assert.match(read(root, 'agentic', 'agents', 'reader.md'), /^tools:.*mcp__figma/m);
    assert.match(read(root, 'AGENTS.md'), /\| design \| `figma` \|/);
  });

  // The reader is the only agent that fetches, so it is the only one that gets a
  // server. A specificator with MCP tools could quietly go and read a page.
  it('leaves every other agent without a server', async () => {
    const root = withServers({ jira: { url: 'x' }, figma: { url: 'y' } });
    await run(root);

    for (const agent of ['specificator.md', 'planner.md']) {
      const tools = read(root, 'agentic', 'agents', agent).match(/^tools:.*$/m)?.[0] ?? '';
      assert.doesNotMatch(tools, /mcp__/, agent);
    }
  });

  it('leaves the allowlist bare when nothing is connected', async () => {
    const root = tmpProject();
    await run(root);

    const tools = read(root, 'agentic', 'agents', 'reader.md').match(/^tools:.*$/m)?.[0] ?? '';
    assert.equal(tools, 'tools: Read, Grep, Glob, Write, Agent');
  });

  // Same rule as every other generated file: ours to rewrite only while it is
  // still byte for byte what we wrote.
  it('leaves a reader you edited alone, and says what to set yourself', async () => {
    const root = tmpProject();
    await run(root);
    const reader = path.join(root, 'agentic', 'agents', 'reader.md');
    fs.writeFileSync(reader, `${fs.readFileSync(reader, 'utf8')}\n\nmy own note\n`);
    writeJson(path.join(root, '.mcp.json'), { mcpServers: { jira: { url: 'x' } } });

    const { value, output } = await run(root);

    assert.ok(value.warnings >= 1);
    assert.match(output, /reader\.md was edited by hand/);
    assert.match(output, /set its allowlist yourself/);
    assert.match(read(root, 'agentic', 'agents', 'reader.md'), /my own note/);
    assert.doesNotMatch(read(root, 'agentic', 'agents', 'reader.md'), /mcp__jira/);
  });

  it('ignores servers that fill none of the roles', async () => {
    const root = withServers({ postgres: { url: 'x' } });
    await run(root);

    const tools = read(root, 'agentic', 'agents', 'reader.md').match(/^tools:.*$/m)?.[0] ?? '';
    assert.doesNotMatch(tools, /postgres/);
  });
});

// Above the limit Claude Code saves an MCP answer to a file instead of handing it
// to the model. Without it a large page lands whole in a reader's small context.
describe('init and the MCP output limit', () => {
  const settingsOf = (root: string) => path.join(root, 'agentic', 'settings.json');
  const prepare = (content: string) => {
    const root = tmpProject();
    fs.mkdirSync(path.join(root, 'agentic'), { recursive: true });
    fs.writeFileSync(settingsOf(root), content);
    return root;
  };

  it('sets the limit in the settings.json it creates', async () => {
    const root = tmpProject();
    await run(root);

    const settings = JSON.parse(fs.readFileSync(settingsOf(root), 'utf8'));
    assert.equal(settings.env.MAX_MCP_OUTPUT_TOKENS, String(MCP_OUTPUT_TOKENS));
  });

  it('leaves a settings.json you already had alone, and says the line to add', async () => {
    const mine = '{ "permissions": { "allow": [] } }\n';
    const root = prepare(mine);

    const { output } = await run(root);

    assert.equal(fs.readFileSync(settingsOf(root), 'utf8'), mine);
    assert.match(output, /sets no MCP output limit/);
    assert.ok(output.includes(`"MAX_MCP_OUTPUT_TOKENS": "${MCP_OUTPUT_TOKENS}"`));
  });

  it('says nothing when your settings.json sets a limit of its own', async () => {
    const root = prepare('{ "env": { "MAX_MCP_OUTPUT_TOKENS": "20000" } }\n');

    const { output } = await run(root);

    assert.doesNotMatch(output, /MCP output limit/);
  });

  it('says so when settings.json cannot be read as JSON', async () => {
    const root = prepare('{ not json\n');

    const { output } = await run(root);

    assert.match(output, /not valid JSON/);
    assert.equal(fs.readFileSync(settingsOf(root), 'utf8'), '{ not json\n');
  });
});

describe('init after the package was upgraded', () => {
  const SKILL = path.join('agentic', 'skills', 'spec', 'SKILL.md');

  /**
   * An upgrade, told from the project's side: the file on disk and the hash in
   * the manifest are both of the *older* version, and the package now ships
   * something different.
   */
  const pretendOlder = (root: string, file: string, body: string) => {
    fs.writeFileSync(path.join(root, file), body);
    const manifest = defined(readManifest(root));
    fileEntry(manifest, file).hash = hash(body);
    fs.writeFileSync(path.join(root, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + '\n');
  };

  // An upgrade that switches a source off takes effect on the run that brings it
  // in: the tools and the roles table follow the new declaration, not the old.
  it('follows a source the upgrade itself switched off', async () => {
    const root = tmpProject();
    writeJson(path.join(root, '.mcp.json'), { mcpServers: { jira: { url: 'x' }, figma: { url: 'y' } } });
    await run(root);

    const FIGMA = path.join('agentic', 'skills', 'figma', 'SKILL.md');
    pretendOlder(root, FIGMA, read(root, FIGMA).replace('| fetch | no |', '| fetch | yes |'));
    await silenced(() => config({ cwd: root }));
    assert.match(read(root, 'agentic', 'agents', 'reader.md'), /^tools:.*mcp__figma/m);

    const { value } = await run(root);

    assert.match(read(root, FIGMA), /\| fetch \| no \|/);
    assert.doesNotMatch(read(root, 'agentic', 'agents', 'reader.md'), /mcp__figma/);
    assert.match(read(root, 'AGENTS.md'), /\| design \| — \(links only\) \|/);
    assert.equal(value.warnings, 0);
  });

  it('brings an untouched file up to the version the package ships', async () => {
    const root = tmpProject();
    await run(root);
    pretendOlder(root, SKILL, 'the old spec skill\n');

    const { value, output } = await run(root);

    assert.equal(value.updated, 1);
    assert.match(output, /updated {2}agentic\/skills\/spec\/SKILL\.md/);
    assert.match(read(root, SKILL), /^---\nname: spec/);
  });

  it('records the new hash, so the next run has nothing to do', async () => {
    const root = tmpProject();
    await run(root);
    pretendOlder(root, SKILL, 'the old spec skill\n');
    await run(root);

    const { value } = await run(root);

    assert.equal(value.updated, 0);
    assert.equal(recordedHash(defined(readManifest(root)).entries, SKILL), hash(read(root, SKILL)));
  });

  it('leaves a file you edited alone, and says why once', async () => {
    const root = tmpProject();
    await run(root);
    // the manifest still holds the old version's hash, the file holds your edit
    fs.writeFileSync(path.join(root, SKILL), 'my own spec skill\n');
    const manifest = defined(readManifest(root));
    fileEntry(manifest, SKILL).hash = hash('the old spec skill\n');
    fs.writeFileSync(path.join(root, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + '\n');

    const { value, output } = await run(root);

    assert.equal(value.warnings, 1);
    assert.match(output, /was edited, and the package has a newer version/);
    assert.equal(read(root, SKILL), 'my own spec skill\n');
  });

  it('says nothing about your edits when the package has nothing newer', async () => {
    const root = tmpProject();
    await run(root);
    fs.writeFileSync(path.join(root, SKILL), read(root, SKILL) + '\nmy own note\n');

    const { value, output } = await run(root);

    assert.equal(value.warnings, 0);
    assert.equal(value.updated, 0);
    assert.match(output, /your version/);
  });

  it('updates nothing during a dry run', async () => {
    const root = tmpProject();
    await run(root);
    pretendOlder(root, SKILL, 'the old spec skill\n');

    const { output } = await run(root, { dryRun: true });

    assert.match(output, /would update/);
    assert.equal(read(root, SKILL), 'the old spec skill\n');
  });

  // Claude Code reads skills and agents when a session starts, so a refreshed
  // file does nothing until that session is started again.
  it('asks for a session restart when the run only updated things', async () => {
    const root = tmpProject();
    await run(root);
    pretendOlder(root, SKILL, 'the old spec skill\n');

    const { value, output } = await run(root);

    assert.equal(value.created, 0);
    assert.match(output, /restart your Claude session/);
  });

  it('gives the three-step start instead on a first run', async () => {
    const { output } = await run(tmpProject());

    assert.doesNotMatch(output, /restart your Claude session/);
    assert.match(output, /specify your first task/);
  });

  it('asks for nothing when the run changed nothing at all', async () => {
    const root = tmpProject();
    await run(root);

    const { output } = await run(root);

    assert.doesNotMatch(output, /next:/);
  });
});

describe('init after the package stopped shipping a file', () => {
  const RETIRED = path.join('agentic', 'skills', 'retired', 'SKILL.md');

  /** A file an older version of the package wrote, recorded as ours. */
  const pretendShipped = (root: string, file: string, body: string) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);

    const manifest = defined(readManifest(root));
    manifest.entries.push({ path: file, type: 'file', hash: hash(body) });
    fs.writeFileSync(path.join(root, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + '\n');
  };

  it('removes it, together with the directory it was alone in', async () => {
    const root = tmpProject();
    await run(root);
    pretendShipped(root, RETIRED, 'the retired skill\n');

    const { value, output } = await run(root);

    assert.equal(value.removed, 2); // the file, then its directory
    assert.match(output, /removed {2}agentic\/skills\/retired\/SKILL\.md/);
    assert.equal(fs.existsSync(path.join(root, 'agentic', 'skills', 'retired')), false);
    assert.equal(defined(readManifest(root)).entries.some((e) => e.path === RETIRED), false);
  });

  it('keeps one you edited, and says why', async () => {
    const root = tmpProject();
    await run(root);
    pretendShipped(root, RETIRED, 'the retired skill\n');
    fs.writeFileSync(path.join(root, RETIRED), 'my own version\n');

    const { value, output } = await run(root);

    assert.equal(value.removed, 0);
    assert.equal(value.warnings, 1);
    assert.match(output, /the package no longer ships it/);
    assert.equal(read(root, RETIRED), 'my own version\n');
    // still ours to remove later, so reset --force can still account for it
    assert.ok(defined(readManifest(root)).entries.some((e) => e.path === RETIRED));
  });

  it('says nothing about one you already deleted, but stops recording it', async () => {
    const root = tmpProject();
    await run(root);
    pretendShipped(root, RETIRED, 'the retired skill\n');
    fs.rmSync(path.join(root, 'agentic', 'skills', 'retired'), { recursive: true });

    const { value } = await run(root);

    assert.equal(value.removed, 0);
    assert.equal(value.warnings, 0);
    assert.equal(defined(readManifest(root)).entries.some((e) => e.path === RETIRED), false);
  });

  // Only a hand-edited manifest gets here. Without a hash nothing proves the
  // file is ours, so it stays — quietly, since the user did not do this.
  it('leaves it alone when the manifest recorded no hash for it', async () => {
    const root = tmpProject();
    await run(root);
    pretendShipped(root, RETIRED, 'the retired skill\n');
    const manifest = defined(readManifest(root));
    delete fileEntry(manifest, RETIRED).hash;
    fs.writeFileSync(path.join(root, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + '\n');

    const { value } = await run(root);

    assert.equal(value.removed, 0);
    assert.equal(value.warnings, 0);
    assert.ok(fs.existsSync(path.join(root, RETIRED)));
  });

  it('warns instead of deleting when a directory stands where the file did', async () => {
    const root = tmpProject();
    await run(root);
    pretendShipped(root, RETIRED, 'the retired skill\n');
    fs.rmSync(path.join(root, RETIRED));
    fs.mkdirSync(path.join(root, RETIRED));

    const { value, output } = await run(root);

    assert.equal(value.removed, 0);
    assert.match(output, /no longer a regular file/);
    assert.ok(fs.statSync(path.join(root, RETIRED)).isDirectory());
  });

  it('deletes nothing during a dry run', async () => {
    const root = tmpProject();
    await run(root);
    pretendShipped(root, RETIRED, 'the retired skill\n');

    const { output } = await run(root, { dryRun: true });

    assert.match(output, /would remove {2}agentic\/skills\/retired\/SKILL\.md/);
    assert.equal(read(root, RETIRED), 'the retired skill\n');
  });

  it('never touches a file the package still ships', async () => {
    const root = tmpProject();
    await run(root);

    const { value } = await run(root);

    assert.equal(value.removed, 0);
    assert.ok(fs.existsSync(path.join(root, 'agentic', 'skills', 'spec', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(root, 'agentic', 'skills', '.gitkeep')));
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
  });

  // A skill you declared yourself was never in the manifest, so prune cannot
  // see it — the package never shipped it and never will.
  it('never removes a source skill you added yourself', async () => {
    const root = tmpProject();
    await run(root);
    await silenced(() => addSource({ cwd: root, name: 'notion', matches: 'notion.so' }));

    await run(root);

    assert.ok(fs.existsSync(path.join(root, 'agentic', 'skills', 'notion', 'SKILL.md')));
  });

  it('leaves a directory that still holds something of yours', async () => {
    const root = tmpProject();
    await run(root);
    pretendShipped(root, RETIRED, 'the retired skill\n');
    fs.writeFileSync(path.join(root, 'agentic', 'skills', 'retired', 'notes.md'), 'mine\n');

    await run(root);

    assert.equal(fs.existsSync(path.join(root, RETIRED)), false);
    assert.equal(read(root, 'agentic', 'skills', 'retired', 'notes.md'), 'mine\n');
  });
});

describe('the version that wrote the scaffold', () => {
  it('is recorded in the manifest', async () => {
    const root = tmpProject();
    await run(root);

    assert.equal(defined(readManifest(root)).packageVersion, ownPackage().version);
  });

  it('is announced when an older one wrote it', async () => {
    const root = tmpProject();
    await run(root);
    const manifest = readManifest(root);
    fs.writeFileSync(
      path.join(root, MANIFEST_PATH),
      JSON.stringify({ ...manifest, packageVersion: '0.0.1' }, null, 2) + '\n',
    );

    const { output } = await run(root);

    assert.match(output, new RegExp(`upgrading 0\\.0\\.1 -> ${ownPackage().version.replace(/\./g, '\\.')}`));
  });

  // `init` tells people to run `config` next, so config must not be able to
  // erase the difference that makes the upgrade visible.
  it('survives a config run in between', async () => {
    const root = tmpProject();
    await run(root);
    const manifest = readManifest(root);
    fs.writeFileSync(
      path.join(root, MANIFEST_PATH),
      JSON.stringify({ ...manifest, packageVersion: '0.0.1' }, null, 2) + '\n',
    );

    await silenced(() => config({ cwd: root }));
    const { output } = await run(root);

    assert.match(output, /upgrading 0\.0\.1 ->/);
  });

  it('is not announced on a first run, or on a run of the same version', async () => {
    const root = tmpProject();
    const first = await run(root);
    const second = await run(root);

    assert.doesNotMatch(first.output, /upgrading/);
    assert.doesNotMatch(second.output, /upgrading/);
  });
});
