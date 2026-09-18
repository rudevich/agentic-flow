import { bold, cyan, dim, red, yellow } from '../platform/color.ts';
import type { Reporter } from '../platform/fsx.ts';
import type { Mapping } from '../model/mcp.ts';
import { rolesOf, type Source } from '../model/sources.ts';

/** What stands where the `.claude` link to agentic/ should be. */
export type ClaudeConflict = { status: 'dir' | 'file' } | { status: 'symlink'; target: string };

/** As much of a source as the hint prints. */
type Hinted = Pick<Source, 'name' | 'role' | 'server' | 'auth'> & { fetch?: Source['fetch'] };

const HOW = [
  'claude mcp add --transport http <name> https://<host>/mcp',
  'or add it to .mcp.json in this project, or authorise a connector with /mcp',
];

/**
 * What to do about the roles nothing fills. Built from the sources' own
 * `## Source` declarations, so a source added later explains itself with no
 * change here. Empty when everything is connected. A source that says
 * `fetch: no` is never read, so it needs no server and is not mentioned.
 */
export function connectHint(sources: readonly Hinted[], mapping: Mapping): string[] {
  const order = rolesOf(sources);
  const open = sources
    .filter(({ role, fetch }) => fetch !== 'no' && !mapping[role])
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
    .map((source) => ({ ...source, names: (source.server.length ? source.server : [source.name]).join(', ') }));
  if (!open.length) return [];

  const roles = [...new Set(open.map(({ role }) => role))];
  const roleWidth = Math.max(...roles.map((role) => role.length));
  const nameWidth = Math.max(...open.map(({ names }) => names.length));

  const lines = [
    yellow(`no MCP server for: ${roles.join(', ')}`),
    'connect one, then run `npx @rudevich/agentic-flow config`:',
    ...HOW.map((line) => `  ${cyan(line)}`),
    "which server names fill which role, from the skills' ## Source blocks:",
  ];

  // Padding happens before colouring, so the columns line up either way.
  for (const { name, role, auth, names } of open) {
    lines.push(`  ${cyan(role.padEnd(roleWidth))}  <- ${names.padEnd(nameWidth)}  ${dim(`agentic/skills/${name}/SKILL.md`)}`);
    if (auth === 'none') {
      lines.push(dim(`  ${' '.repeat(roleWidth)}     takes no token — that skill says how it connects`));
    }
  }

  return lines;
}

export function printConnectHint(sources: readonly Hinted[], mapping: Mapping, reporter: Reporter): boolean {
  const lines = connectHint(sources, mapping);
  if (!lines.length) return false;

  console.log('');
  for (const line of lines) reporter.info(line);
  return true;
}

const WHAT: Record<ClaudeConflict['status'], (target?: string) => string> = {
  dir: () => '.claude is a real directory, not a link to agentic/',
  file: () => '.claude is a real file, not a link to agentic/',
  symlink: (target) => `.claude is a symlink to ${target}, not to agentic/`,
};

const FIX: Record<ClaudeConflict['status'], string[]> = {
  dir: [
    'either move it aside and let init link it:',
    `  ${cyan('mv .claude/* agentic/ && rmdir .claude && npx @rudevich/agentic-flow init')}`,
    'or keep it and link the parts:',
    ...['skills', 'agents', 'hooks'].map((dir) => `  ${cyan(`ln -s ../agentic/${dir} .claude/${dir}`)}`),
  ],
  file: ['remove it and run init again:', `  ${cyan('rm .claude && npx @rudevich/agentic-flow init')}`],
  symlink: ['repoint it:', `  ${cyan('npx @rudevich/agentic-flow init --force')}`],
};

/**
 * The one failure that makes everything else pointless: without `.claude`
 * resolving to `agentic/`, Claude Code sees no skills and `/spec` is not a
 * command. Said loudly, at the end, because that is where people look.
 */
export function claudeHint(conflict: ClaudeConflict | null): string[] {
  if (!conflict) return [];

  const target = conflict.status === 'symlink' ? conflict.target : undefined;
  return [
    red(bold(WHAT[conflict.status](target))),
    'Claude Code reads skills and agents from .claude — until this is fixed',
    `it sees none of them, and ${bold('/spec does not exist')}`,
    ...FIX[conflict.status],
  ];
}

export function printClaudeHint(conflict: ClaudeConflict | null, reporter: Reporter): boolean {
  const lines = claudeHint(conflict);
  if (!lines.length) return false;

  console.log('');
  for (const line of lines) reporter.info(line);
  return true;
}
