import { PREFIX } from './fsx.js';
import { rolesOf } from './sources.js';

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
    `no MCP server for: ${roles.join(', ')}`,
    'connect one, then run `agentic-flow config`:',
    ...HOW.map((line) => `  ${line}`),
    "which server names fill which role, from the skills' ## Source blocks:",
  ];

  open.forEach(({ name, role, auth }, i) => {
    lines.push(`  ${role.padEnd(roleWidth)}  <- ${names[i].padEnd(nameWidth)}  agentic/skills/${name}/SKILL.md`);
    if (auth === 'none') {
      lines.push(`  ${' '.repeat(roleWidth)}     takes no token — that skill says how it connects`);
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

export { PREFIX };
