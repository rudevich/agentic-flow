import fs from 'node:fs';
import path from 'node:path';

import { BUILTIN_ROLES, SKILLS_DIR, SOURCE_HEADING } from './constants.js';
import { statOrNull } from './fsx.js';
import { TEMPLATES_DIR } from './utils.js';

const SEED_SKILLS = path.join(TEMPLATES_DIR, 'seed', 'skills');

const REQUIRED = ['role', 'matches', 'writes'];

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
    const stat = statOrNull(file);
    if (!stat) continue;

    // Reading a directory throws, and one broken skill must not end the run.
    if (!stat.isFile()) {
      reporter?.warn(
        `${entry.name}: its SKILL.md is not a regular file — ignored`,
        'remove or rename it, then run agentic-flow init again',
      );
      continue;
    }

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
