import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The part of a package.json this package reads. */
export interface PackageJson {
  name?: string;
  version: string;
  bin?: Record<string, string>;
  engines?: { node?: string };
}

export interface ProjectRoot {
  root: string;
  pkgPath: string;
}

/** Walks up from `startDir` to the nearest directory holding a package.json. */
export function findProjectRoot(startDir: string): ProjectRoot | null {
  let dir = path.resolve(startDir);

  for (;;) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) return { root: dir, pkgPath };

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Where this package lives. Found by walking up rather than by counting `..`:
 * the same module runs from src/ in this repository and from dist/src/ once
 * published, one directory deeper.
 */
function locatePackageRoot(): string {
  const found = findProjectRoot(path.dirname(fileURLToPath(import.meta.url)));
  if (!found) throw new Error('cannot find the package.json this module belongs to');
  return found.root;
}

export const packageRoot = locatePackageRoot();

export function ownPackage(): PackageJson {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as PackageJson;
}

export function projectName(root: string, pkgPath: string): string {
  try {
    const { name } = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Partial<PackageJson>;
    return name || path.basename(root);
  } catch {
    return path.basename(root);
  }
}
