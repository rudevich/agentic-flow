import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { classify, detectServers, mapRoles, rolesBlock, toolsLine } from '../../model/mcp.ts';
import { tmpDir, tmpProject, writeJson } from '../helpers.ts';

/** Lays out one desktop-app plugin the way the app does, and returns its `rpm` directory. */
function desktopPlugin(
  home: string,
  plugin: { id?: string; name?: string; installationPreference?: string },
  mcp: unknown,
): string {
  const rpm = path.join(home, 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions', 'session', 'run', 'rpm');
  writeJson(path.join(rpm, 'manifest.json'), { plugins: [plugin] });
  writeJson(path.join(rpm, `${plugin.id}`, '.mcp.json'), mcp);
  return rpm;
}

describe('classify', () => {
  it('maps a name to the roles it can serve', () => {
    assert.deepEqual(classify('jira'), ['tracker']);
    assert.deepEqual(classify('confluence'), ['docs']);
    assert.deepEqual(classify('figma'), ['design']);
  });

  it('treats an Atlassian server as both tracker and docs', () => {
    assert.deepEqual(classify('atlassian'), ['tracker', 'docs']);
    assert.deepEqual(classify('plugin:product-management:atlassian'), ['tracker', 'docs']);
  });

  it('ignores servers that fill none of our roles', () => {
    assert.deepEqual(classify('linear'), []);
    assert.deepEqual(classify('postgres'), []);
  });

  it('is case-insensitive', () => {
    assert.deepEqual(classify('Corp-JIRA-Cloud'), ['tracker']);
  });
});

describe('detectServers', () => {
  it('reads the project .mcp.json', () => {
    const root = tmpProject();
    writeJson(path.join(root, '.mcp.json'), { mcpServers: { jira: { url: 'x' } } });

    const found = detectServers(root, { home: tmpDir() });
    assert.deepEqual(found, [{ id: 'jira', source: 'project' }]);
  });

  it('reads user scope from ~/.claude.json, both global and per-project', () => {
    const root = tmpProject();
    const home = tmpDir();
    writeJson(path.join(home, '.claude.json'), {
      mcpServers: { atlassian: { url: 'x' } },
      projects: { [root]: { mcpServers: { figma: { url: 'y' } } } },
    });

    const ids = detectServers(root, { home }).map(({ id }) => id);
    assert.deepEqual(ids.sort(), ['atlassian', 'figma']);
  });

  it('reads settings.json and settings.local.json', () => {
    const home = tmpDir();
    writeJson(path.join(home, '.claude', 'settings.json'), { mcpServers: { jira: { url: 'x' } } });
    writeJson(path.join(home, '.claude', 'settings.local.json'), { mcpServers: { figma: { url: 'y' } } });

    const ids = detectServers(tmpProject(), { home }).map(({ id }) => id);
    assert.deepEqual(ids.sort(), ['figma', 'jira']);
  });

  // Plugin .mcp.json files hold servers at the top level, with no mcpServers wrapper.
  it('reads plugin servers and prefixes them with plugin:<name>:', () => {
    const home = tmpDir();
    writeJson(path.join(home, '.claude', 'settings.json'), {
      enabledPlugins: { 'product-management@official': true },
    });
    writeJson(
      path.join(home, '.claude', 'plugins', 'marketplaces', 'official', 'external_plugins', 'product-management', '.mcp.json'),
      { atlassian: { url: 'x' }, figma: { url: 'y' } },
    );

    const found = detectServers(tmpProject(), { home });
    assert.deepEqual(found, [
      { id: 'plugin:product-management:atlassian', source: 'plugin' },
      { id: 'plugin:product-management:figma', source: 'plugin' },
    ]);
  });

  // Personal settings go in the local file, and a plugin enabled there counts.
  it('reads plugins enabled in settings.local.json too', () => {
    const home = tmpDir();
    writeJson(path.join(home, '.claude', 'settings.local.json'), {
      enabledPlugins: { 'product-management@official': true },
    });
    writeJson(
      path.join(home, '.claude', 'plugins', 'marketplaces', 'official', 'external_plugins', 'product-management', '.mcp.json'),
      { figma: { url: 'y' } },
    );

    const ids = detectServers(tmpProject(), { home }).map(({ id }) => id);
    assert.deepEqual(ids, ['plugin:product-management:figma']);
  });

  it('skips plugins that are turned off', () => {
    const home = tmpDir();
    writeJson(path.join(home, '.claude', 'settings.json'), {
      enabledPlugins: { 'product-management@official': false },
    });
    writeJson(
      path.join(home, '.claude', 'plugins', 'marketplaces', 'official', 'external_plugins', 'product-management', '.mcp.json'),
      { atlassian: { url: 'x' } },
    );

    assert.deepEqual(detectServers(tmpProject(), { home }), []);
  });

  // The desktop app installs plugins outside ~/.claude, under its own session tree.
  it('reads plugins the desktop app installed', () => {
    const home = tmpDir();
    const rpm = desktopPlugin(home, { id: 'plugin_abc', name: 'product-management' }, {
      mcpServers: { atlassian: { url: 'x' }, figma: { url: 'y' } },
    });
    assert.ok(fs.existsSync(rpm));

    const found = detectServers(tmpProject(), { home });
    assert.deepEqual(found, [
      { id: 'plugin:product-management:atlassian', source: 'plugin' },
      { id: 'plugin:product-management:figma', source: 'plugin' },
    ]);
  });

  it('skips a desktop plugin the user turned off', () => {
    const home = tmpDir();
    desktopPlugin(
      home,
      { id: 'plugin_abc', name: 'product-management', installationPreference: 'disabled' },
      { mcpServers: { figma: { url: 'y' } } },
    );

    assert.deepEqual(detectServers(tmpProject(), { home }), []);
  });

  it('ignores a declared server with no url to reach', () => {
    const home = tmpDir();
    desktopPlugin(home, { id: 'plugin_abc', name: 'pm' }, {
      mcpServers: { figma: { url: 'y' }, gmail: { url: '' } },
    });

    const ids = detectServers(tmpProject(), { home }).map(({ id }) => id);
    assert.deepEqual(ids, ['plugin:pm:figma']);
  });

  it('keeps the nearest scope when an id appears twice', () => {
    const root = tmpProject();
    const home = tmpDir();
    writeJson(path.join(root, '.mcp.json'), { mcpServers: { jira: { url: 'project' } } });
    writeJson(path.join(home, '.claude.json'), { mcpServers: { jira: { url: 'user' } } });

    assert.deepEqual(detectServers(root, { home }), [{ id: 'jira', source: 'project' }]);
  });

  it('survives a broken config instead of throwing', () => {
    const root = tmpProject();
    const home = tmpDir();
    fs.writeFileSync(path.join(home, '.claude.json'), '{ not json');
    fs.writeFileSync(path.join(root, '.mcp.json'), '<html>');

    assert.deepEqual(detectServers(root, { home }), []);
  });

  it('returns nothing when there is no config at all', () => {
    assert.deepEqual(detectServers(tmpProject(), { home: tmpDir() }), []);
  });
});

describe('mapRoles', () => {
  it('lets one server fill two roles', () => {
    const mapping = mapRoles([{ id: 'atlassian' }, { id: 'figma' }]);
    assert.deepEqual(mapping, { tracker: 'atlassian', docs: 'atlassian', design: 'figma' });
  });

  it('keeps the first server that claims a role', () => {
    const mapping = mapRoles([{ id: 'jira' }, { id: 'atlassian' }]);
    assert.equal(mapping.tracker, 'jira');
    assert.equal(mapping.docs, 'atlassian');
  });

  it('leaves uncovered roles out', () => {
    assert.deepEqual(mapRoles([{ id: 'figma' }]), { design: 'figma' });
  });
});

describe('rolesBlock', () => {
  it('names the server for each role', () => {
    const block = rolesBlock({ tracker: 'atlassian', docs: 'atlassian', design: 'figma' });
    assert.match(block, /^<!-- agentic:mcp-roles -->/);
    assert.match(block, /\| tracker \| `atlassian` \|/);
    assert.match(block, /\| design \| `figma` \|/);
  });

  it('marks a role nothing covers', () => {
    assert.match(rolesBlock({}), /\| tracker \| — \(not connected\) \|/);
  });

  it('marks a role whose sources are only listed, even with a server for it', () => {
    const block = rolesBlock({ tracker: 'jira', design: 'figma' }, ['tracker', 'design'], new Set(['design']));

    assert.match(block, /\| design \| — \(links only\) \|/);
    assert.match(block, /\| tracker \| `jira` \|/);
  });
});

describe('toolsLine', () => {
  it('keeps the base tools and adds one entry per distinct server', () => {
    const line = toolsLine({ tracker: 'atlassian', docs: 'atlassian', design: 'figma' });
    assert.equal(line, 'tools: Read, Grep, Glob, Write, Agent, mcp__atlassian, mcp__figma');
  });

  it('never grants Edit or Bash', () => {
    const line = toolsLine({ tracker: 'jira', docs: 'confluence', design: 'figma' });
    assert.doesNotMatch(line, /\bEdit\b/);
    assert.doesNotMatch(line, /\bBash\b/);
  });

  it('falls back to the base tools when nothing is connected', () => {
    assert.equal(toolsLine({}), 'tools: Read, Grep, Glob, Write, Agent');
  });

  // Nobody reads the design during a spec, so its tool schemas would only fill
  // the reader's context. The designer asks for that role by name instead.
  it('takes only the roles it was given', () => {
    const line = toolsLine({ tracker: 'jira', design: 'figma' }, ['tracker']);
    assert.equal(line, 'tools: Read, Grep, Glob, Write, Agent, mcp__jira');
  });

  it('keeps a server that also fills a role that was given', () => {
    const line = toolsLine({ docs: 'atlassian', design: 'atlassian' }, ['docs']);
    assert.equal(line, 'tools: Read, Grep, Glob, Write, Agent, mcp__atlassian');
  });

  it('gives one role its own server, for an agent that asks for it alone', () => {
    const line = toolsLine({ tracker: 'jira', design: 'figma' }, ['design']);
    assert.equal(line, 'tools: Read, Grep, Glob, Write, Agent, mcp__figma');
  });
});

describe('classify with declared sources', () => {
  const sources = [
    { name: 'notion', role: 'research', server: ['notion'] },
    { name: 'jira', role: 'tracker', server: ['jira', 'atlassian'] },
    { name: 'confluence', role: 'docs', server: ['confluence', 'atlassian'] },
  ];

  it('gives a server the role its source declared', () => {
    assert.deepEqual(classify('notion', sources), ['research']);
    assert.deepEqual(classify('plugin:pm:notion', sources), ['research']);
  });

  it('lets two sources name the same server', () => {
    assert.deepEqual(classify('atlassian', sources), ['tracker', 'docs']);
  });

  it('knows nothing about servers no source declared', () => {
    assert.deepEqual(classify('figma', sources), []);
  });

  it('maps an invented role onto the server that serves it', () => {
    const mapping = mapRoles([{ id: 'notion' }], sources);

    assert.deepEqual(mapping, { research: 'notion' });
    assert.equal(toolsLine(mapping), 'tools: Read, Grep, Glob, Write, Agent, mcp__notion');
  });

  it('renders a row for an invented role', () => {
    assert.match(
      rolesBlock({ research: 'notion' }, ['tracker', 'research']),
      /\| research \| `notion` \|/,
    );
  });
});
