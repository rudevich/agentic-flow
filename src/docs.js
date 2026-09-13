import fs from 'node:fs';
import path from 'node:path';

import { AGENTS_FILE, LANGUAGE_MARKER } from './constants.js';
import { statOrNull } from './fsx.js';

export const LANGUAGES = {
  english: 'Write every document you generate in English, whatever the language of the request.',
  request: 'Write every document you generate in the language the request was written in.',
};

export const DEFAULT_LANGUAGE = 'request';

export function languageLine(choice) {
  return LANGUAGES[choice] ?? LANGUAGES[DEFAULT_LANGUAGE];
}

export function languageBlock(choice) {
  return `${LANGUAGE_MARKER}\n${languageLine(choice)}`;
}

/**
 * Reads `--lang`. `null` means "not asked for" — and that is the difference that
 * matters: a setting already in AGENTS.md is only ever changed on request, never
 * as a side effect of running init again.
 */
export function parseLang(value, reporter) {
  if (value === undefined || value === null || value === '') return null;

  const choice = String(value).trim().toLowerCase();
  if (choice === 'english' || choice === 'en' || choice === 'e') return 'english';
  if (choice === 'request' || choice === 'r') return 'request';

  reporter?.warn(`--lang ${value} is not a language I know`, 'use --lang english or --lang request');
  return null;
}

/**
 * Replaces the block under `marker` in AGENTS.md, touching nothing else. A block
 * runs from the marker to the next blank line, so it covers both a one-line rule
 * and a small table.
 *
 * Returns 'updated' | 'unchanged' | 'no-marker' | 'no-file'.
 */
export function applyBlock(root, marker, block, { dryRun, reporter, label }) {
  const file = path.join(root, AGENTS_FILE);
  const name = label ?? marker;

  if (!statOrNull(file)) return 'no-file';

  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  const start = lines.findIndex((line) => line.trim() === marker);

  if (start === -1) {
    reporter.warn(`${AGENTS_FILE} has no ${name} marker`, 'paste this where it belongs:');
    console.log(`\n${block.replace(/^/gm, '    ')}\n`);
    return 'no-marker';
  }

  let end = start + 1;
  while (end < lines.length && lines[end].trim() !== '') end += 1;

  const current = lines.slice(start, end).join('\n');
  if (current === block) {
    reporter.skipped(`${AGENTS_FILE}: ${name}`, 'already set');
    return 'unchanged';
  }

  lines.splice(start, end - start, ...block.split('\n'));
  if (!dryRun) fs.writeFileSync(file, lines.join('\n'));
  // The file was already there — this rewrites a block inside it. Calling that
  // "created" makes init count a re-scan as a first run and say so.
  reporter.updated(`${AGENTS_FILE}: ${name}`);
  return 'updated';
}

export function applyDocLanguage(root, choice, opts) {
  return applyBlock(root, LANGUAGE_MARKER, languageBlock(choice), { ...opts, label: 'document language' });
}
