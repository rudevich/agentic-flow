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

/** Project settings. Claude Code reaches them as `.claude/settings.json`. */
export const SETTINGS_PATH = path.join(AGENTIC_DIR, 'settings.json');

/** An agent whose `tools:` line we generate from the servers this project can see. */
export interface McpAgent {
  path: string;
  /** The placeholder its seed file carries, filled in when the agent is copied. */
  placeholder: string;
  /** The roles it may reach, or null for every role somebody reads. */
  roles: readonly string[] | null;
}

/**
 * The only two agents that talk to MCP. The reader fetches the pages a
 * specification is written from, and keeping it alone there is what stops a page
 * reaching anybody else's context. The designer reads designs after the
 * specification exists, so it keeps the design role even while `spec` only lists
 * those links.
 */
export const MCP_AGENTS: readonly McpAgent[] = [
  { path: path.join(AGENTIC_DIR, 'agents', 'reader.md'), placeholder: 'MCP_TOOLS', roles: null },
  { path: path.join(AGENTIC_DIR, 'agents', 'designer.md'), placeholder: 'DESIGN_TOOLS', roles: ['design'] },
];

/**
 * `MAX_MCP_OUTPUT_TOKENS`: above this, Claude Code saves an MCP answer to a file
 * and hands the model its path instead of the page. Sized for a ~32k window — a
 * reader given more than this inline has too little room left to write the
 * snapshot. The reader reads a saved answer in parts instead.
 */
export const MCP_OUTPUT_TOKENS = 4000;

/** Written by hand, if at all — the package stopped managing tokens. */
export const ENV_FILE = '.env.agentic';

// --- the blocks we rewrite inside files that belong to the user ---

export const LANGUAGE_MARKER = '<!-- agentic:doc-language -->';
export const ROLES_MARKER = '<!-- agentic:mcp-roles -->';

/** The heading a skill declares itself a source under. */
export const SOURCE_HEADING = '## Source';

// --- roles, and the sources the package ships ---

/** The roles the package itself ships. Extras declared by a source come after. */
export const BUILTIN_ROLES: readonly string[] = ['tracker', 'docs', 'design'];

/** What a seed skill declares, as far as matching a server to a role needs it. */
export interface BuiltinSource {
  name: string;
  role: string;
  server: string[];
  auth: 'token' | 'none';
  links: 'follow' | 'stop';
  /** `no`: spec lists this source's links and never sends a reader to them. */
  fetch: 'yes' | 'no';
}

/**
 * What the seed skills declare, kept here so `classify` has an answer before any
 * project exists. Mirrors the `## Source` blocks in src/templates/seed/skills/.
 */
export const BUILTIN_SOURCES: readonly BuiltinSource[] = [
  { name: 'jira', role: 'tracker', server: ['jira', 'atlassian'], auth: 'token', links: 'follow', fetch: 'yes' },
  { name: 'confluence', role: 'docs', server: ['confluence', 'atlassian'], auth: 'token', links: 'follow', fetch: 'yes' },
  { name: 'figma', role: 'design', server: ['figma'], auth: 'none', links: 'stop', fetch: 'no' },
];
