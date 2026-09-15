import { bold, cyan, dim, red, yellow } from '../platform/color.js';
import { rolesOf } from '../model/sources.js';

const HOW = [
  'claude mcp add --transport http <name> https://<host>/mcp',
  'or add it to .mcp.json in this project, or authorise a connector with /mcp',
];

/**
 * What to do about the roles nothing fills. Built from the sources' own
 * `## Source` declarations, so a source added later explains itself with no
 * change here. Empty when everything is connected.
 */
export function connectHint(sources, mapping) {
  const order = rolesOf(sources);
  const open = sources
    .filter(({ role }) => !mapping[role])
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  if (!open.length) return [];

  const roles = [...new Set(open.map(({ role }) => role))];
  const names = open.map(({ name, server }) => (server.length ? server : [name]).join(', '));
  const roleWidth = Math.max(...roles.map((role) => role.length));
  const nameWidth = Math.max(...names.map((name) => name.length));

  const lines = [
    yellow(`no MCP server for: ${roles.join(', ')}`),
    'connect one, then run `npx @rudevich/agentic-flow config`:',
    ...HOW.map((line) => `  ${cyan(line)}`),
    "which server names fill which role, from the skills' ## Source blocks:",
  ];

  // Padding happens before colouring, so the columns line up either way.
  open.forEach(({ name, role, auth }, i) => {
    lines.push(`  ${cyan(role.padEnd(roleWidth))}  <- ${names[i].padEnd(nameWidth)}  ${dim(`agentic/skills/${name}/SKILL.md`)}`);
    if (auth === 'none') {
      lines.push(dim(`  ${' '.repeat(roleWidth)}     takes no token — that skill says how it connects`));
    }
  });

  return lines;
}

export function printConnectHint(sources, mapping, reporter) {
  const lines = connectHint(sources, mapping);
  if (!lines.length) return false;

  console.log('');
  for (const line of lines) reporter.info(line);
  return true;
}

const WHAT = {
  dir: () => '.claude is a real directory, not a link to agentic/',
  file: () => '.claude is a real file, not a link to agentic/',
  symlink: (target) => `.claude is a symlink to ${target}, not to agentic/`,
};

const FIX = {
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
export function claudeHint(conflict) {
  if (!conflict) return [];

  const { status, target } = conflict;
  return [
    red(bold(WHAT[status](target))),
    'Claude Code reads skills and agents from .claude — until this is fixed',
    `it sees none of them, and ${bold('/spec does not exist')}`,
    ...FIX[status],
  ];
}

export function printClaudeHint(conflict, reporter) {
  const lines = claudeHint(conflict);
  if (!lines.length) return false;

  console.log('');
  for (const line of lines) reporter.info(line);
  return true;
}
