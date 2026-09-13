import fs from 'node:fs';
import path from 'node:path';

import { hash, statOrNull } from './fsx.js';

export const MANIFEST_PATH = path.join('agentic', '.agentic-manifest.json');

export { hash };

/**
 * Records what init created, so reset can undo exactly that and nothing else.
 * Entries are project-relative; `hash` is null for symlinks and directories.
 */
export function createManifest(root) {
  const file = path.join(root, MANIFEST_PATH);
  const previous = readManifest(root);
  const entries = new Map((previous?.entries ?? []).map((e) => [e.path, e]));

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
      entries.set(`.gitignore:${line}`, { path: '.gitignore', type: 'gitignore-line', line });
    },
    size: () => entries.size,
    write({ dryRun }) {
      if (dryRun) return;
      const payload = {
        version: 1,
        writtenAt: new Date().toISOString(),
        entries: [...entries.values()],
      };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
    },
  };
}

export function readManifest(root) {
  const file = path.join(root, MANIFEST_PATH);
  if (!statOrNull(file)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data.entries) ? data : null;
  } catch {
    return null;
  }
}
