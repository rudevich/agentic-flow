import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { packageRoot } from './project.ts';

/**
 * Small things more than one module needs. Nothing here knows about the
 * scaffold — see constants.ts for the names, fsx.ts for anything that writes.
 */

/**
 * Whether the Node running us is new enough. `engines` only makes npm warn, and
 * `npx` skips even that, so the CLI checks for itself and says so plainly.
 */
export function nodeAtLeast(major: number, version: string = process.versions.node): boolean {
  return Number.parseInt(version, 10) >= major;
}

/** Short content hash — how we later recognise a file as one we wrote. */
export function hash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Reads JSON, or null for anything unreadable — a broken foreign config is not
 * our problem. `T` is what the caller hopes for, not something checked: keep
 * every field of it optional, and look before trusting one.
 */
export function readJson<T = unknown>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** The package's own templates, which ship inside it and are never edited in place. */
export const TEMPLATES_DIR = path.join(packageRoot, 'src', 'templates');

export function readTemplate(...parts: string[]): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, ...parts), 'utf8');
}

/**
 * Replaces every `{{KEY}}` with the value of that key. The replacement is a
 * function on purpose: as a plain string, a value containing `$&` or `$1` would
 * be read as a substitution pattern instead of text.
 */
export function fill(body: string, fields: Readonly<Record<string, string>>): string {
  return Object.entries(fields).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, () => value),
    body,
  );
}
