import fs from 'node:fs';
import path from 'node:path';

import { GITIGNORE_FILE, MANIFEST_PATH } from '../constants.js';
import { hash, readJson } from '../utils.js';

/**
 * Records what init created, so reset can undo exactly that and nothing else.
 * Entries are project-relative; `hash` is null for symlinks and directories.
 */
export function createManifest(root) {
  const file = path.join(root, MANIFEST_PATH);
  const previous = readManifest(root);
  const entries = new Map((previous?.entries ?? []).map((e) => [e.path, e]));
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
    /** Drops an entry for a file this version of the package no longer ships. */
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

export function readManifest(root) {
  const data = readJson(path.join(root, MANIFEST_PATH));
  if (!data || !Array.isArray(data.entries)) return null;

  // Manifests written before we recorded it say nothing about the version.
  return { ...data, packageVersion: data.packageVersion ?? null };
}
