import path from 'node:path';

/**
 * Every name this package writes into a project, and every marker it owns
 * inside a file it does not. One place, so a rename is one edit and no module
 * can disagree with another about where something lives.
 */

/** The tag every line of output carries. */
export const PREFIX = '[agentic]';

/** The oldest Node this package runs on. Must agree with `engines` in package.json. */
export const MIN_NODE_MAJOR = 24;

// --- the layout, relative to the project root ---

export const AGENTIC_DIR = 'agentic';
export const SKILLS_DIR = path.join(AGENTIC_DIR, 'skills');
export const AGENTS_FILE = 'AGENTS.md';
export const CLAUDE_FILE = 'CLAUDE.md';
export const CLAUDE_DIR = '.claude';
export const GITIGNORE_FILE = '.gitignore';
export const MANIFEST_PATH = path.join(AGENTIC_DIR, '.agentic-manifest.json');
export const SPECIFICATOR_PATH = path.join(AGENTIC_DIR, 'agents', 'specificator.md');

/** Written by hand, if at all — the package stopped managing tokens. */
export const ENV_FILE = '.env.agentic';

// --- the blocks we rewrite inside files that belong to the user ---

export const LANGUAGE_MARKER = '<!-- agentic:doc-language -->';
export const ROLES_MARKER = '<!-- agentic:mcp-roles -->';

/** The heading a skill declares itself a source under. */
export const SOURCE_HEADING = '## Source';

// --- roles, and the sources the package ships ---

/** The roles the package itself ships. Extras declared by a source come after. */
export const BUILTIN_ROLES = ['tracker', 'docs', 'design'];

/**
 * What the seed skills declare, kept here so `classify` has an answer before any
 * project exists. Mirrors the `## Source` blocks in src/templates/seed/skills/.
 */
export const BUILTIN_SOURCES = [
  { name: 'jira', role: 'tracker', server: ['jira', 'atlassian'], auth: 'token', links: 'follow' },
  { name: 'confluence', role: 'docs', server: ['confluence', 'atlassian'], auth: 'token', links: 'stop' },
  { name: 'figma', role: 'design', server: ['figma'], auth: 'none', links: 'stop' },
];
