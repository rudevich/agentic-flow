import fs from 'node:fs';
import path from 'node:path';

import { GITIGNORE_FILE, MANIFEST_PATH } from '../constants.ts';
import { hash, readJson } from '../utils.ts';

/**
 * One thing init wrote, project-relative. A file without a hash was recorded by
 * a version that did not keep one, and nothing can prove it is still ours.
 */
export type ManifestEntry =
  | { path: string; type: 'file'; hash?: string | null }
  | { path: string; type: 'symlink'; target?: string }
  | { path: string; type: 'dir' }
  | { path: string; type: 'gitignore-line'; line: string };

/** What agentic/.agentic-manifest.json holds. */
export interface ManifestData {
  /** The format of the file. */
  version?: number;
  /** Which release wrote it; null in manifests written before it was recorded. */
  packageVersion: string | null;
  writtenAt?: string;
  entries: ManifestEntry[];
}

export interface Manifest {
  readonly file: string;
  addFile(absPath: string, content: string): void;
  addLink(absPath: string, target: string): void;
  addDir(absPath: string): void;
  addGitignoreLine(line: string): void;
  /** Drops an entry for a file this version of the package no longer ships. */
  remove(rel: string): void;
  size(): number;
  write(options: { dryRun: boolean; version?: string }): void;
}

/**
 * Records what init created, so reset can undo exactly that and nothing else.
 * Entries are project-relative; only files carry a hash.
 */
export function createManifest(root: string): Manifest {
  const file = path.join(root, MANIFEST_PATH);
  const previous = readManifest(root);
  const entries = new Map<string, ManifestEntry>((previous?.entries ?? []).map((e) => [e.path, e]));
  const previousVersion = previous?.packageVersion ?? null;

  return {
    file,
    addFile(absPath, content) {
      const rel = path.relative(root, absPath);
      entries.set(rel, { path: rel, type: 'file', hash: hash(content) });
    },
    addLink(absPath, target) {
      const rel = path.relative(root, absPath);
      entries.set(rel, { path: rel, type: 'symlink', target });
    },
    addDir(absPath) {
      const rel = path.relative(root, absPath);
      if (!entries.has(rel)) entries.set(rel, { path: rel, type: 'dir' });
    },
    addGitignoreLine(line) {
      entries.set(`${GITIGNORE_FILE}:${line}`, { path: GITIGNORE_FILE, type: 'gitignore-line', line });
    },
    remove(rel) {
      entries.delete(rel);
    },
    size: () => entries.size,
    /**
     * `version` is the release that scaffolded the project, and only `init`
     * scaffolds: every other command carries forward what it found. Stamping it
     * here from the running package would let `config` erase the difference
     * `init` needs to notice an upgrade.
     */
    write({ dryRun, version }) {
      if (dryRun) return;
      const payload = {
        version: 1,
        // Which release wrote this — `version` above is the format of the file.
        packageVersion: version ?? previousVersion,
        writtenAt: new Date().toISOString(),
        entries: [...entries.values()],
      };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
    },
  };
}

export function readManifest(root: string): ManifestData | null {
  const data = readJson<Partial<ManifestData>>(path.join(root, MANIFEST_PATH));
  if (!data || !Array.isArray(data.entries)) return null;

  // Manifests written before we recorded it say nothing about the version.
  return { ...data, entries: data.entries, packageVersion: data.packageVersion ?? null };
}

/** The hash recorded for the file at `rel`, when there is one to compare against. */
export function recordedHash(entries: readonly ManifestEntry[], rel: string): string | undefined {
  const entry = entries.find((e) => e.path === rel);
  return entry?.type === 'file' ? (entry.hash ?? undefined) : undefined;
}
