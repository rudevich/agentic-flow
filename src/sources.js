import fs from 'node:fs';
import path from 'node:path';

import { statOrNull } from './fsx.js';
import { packageRoot } from './project.js';

export const SOURCE_HEADING = '## Source';
export const SKILLS_DIR = path.join('agentic', 'skills');
const SEED_SKILLS = path.join(packageRoot, 'src', 'templates', 'seed', 'skills');

const REQUIRED = ['role', 'matches', 'writes'];

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

const clean = (value) => value.trim().replace(/^`|`$/g, '').trim();
const list = (value) => (value ? value.split(',').map(clean).filter(Boolean) : []);

/**
 * Reads the `## Source` table out of a SKILL.md.
 *
 * `null` means the skill is not a source at all — the common case, and not a
 * problem. A returned object with a non-empty `missing` is a source that
 * declared itself badly; the caller warns and skips it.
 */
export function parseSource(content) {
  const lines = content.split('\n');
  const start = lines.findIndex((line) => line.trim() === SOURCE_HEADING);
  if (start === -1) return null;

  const fields = {};
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('## ')) break;
    if (!line.startsWith('|')) continue;

    const cells = line.split('|').slice(1, -1);
    if (cells.length < 2) continue;

    const key = clean(cells[0]).toLowerCase();
    if (!key || key === 'field' || /^-+$/.test(key)) continue;
    fields[key] = clean(cells[1]);
  }

  return {
    role: fields.role ?? '',
    matches: list(fields.matches),
    writes: fields.writes ?? '',
    server: list(fields.server),
    auth: (fields.auth || 'token').toLowerCase(),
    links: (fields.links || 'follow').toLowerCase(),
    missing: REQUIRED.filter((field) => !fields[field]?.length),
  };
}

function scan(dir, reporter) {
  const found = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;

    const file = path.join(dir, entry.name, 'SKILL.md');
    if (!statOrNull(file)) continue;

    const parsed = parseSource(fs.readFileSync(file, 'utf8'));
    if (!parsed) continue;

    if (parsed.missing.length) {
      reporter?.warn(
        `${entry.name}: its ${SOURCE_HEADING} block has no ${parsed.missing.join(', ')} — ignored`,
        'fill the row in, or drop the block if the skill is not a source',
      );
      continue;
    }

    found.push({ name: entry.name, ...parsed });
  }

  return found;
}

/**
 * Every source this project declares. Falls back to the seed skills while the
 * project has none — the first `init` needs them before it copies anything. Once
 * a project declares its own, only those count: a skill you deleted must not
 * come back as a row in the roles table.
 */
export function readSources(root, { reporter } = {}) {
  const project = scan(path.join(root, SKILLS_DIR), reporter);
  return project.length ? project : scan(SEED_SKILLS, reporter);
}

/** Built-in roles first, then whatever the project's sources invented. */
export function rolesOf(sources) {
  const extra = [...new Set(sources.map(({ role }) => role))]
    .filter((role) => role && !BUILTIN_ROLES.includes(role))
    .sort();
  return [...BUILTIN_ROLES, ...extra];
}

/** The source that reads a given URL, or undefined. */
export function sourceFor(url, sources) {
  const target = url.toLowerCase();
  return sources.find(({ matches }) => matches.some((fragment) => target.includes(fragment.toLowerCase())));
}
