import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../..');

export function ownPackage() {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

/** Walks up from `startDir` to the nearest directory holding a package.json. */
export function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);

  for (;;) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) return { root: dir, pkgPath };

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function projectName(root, pkgPath) {
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).name || path.basename(root);
  } catch {
    return path.basename(root);
  }
}
