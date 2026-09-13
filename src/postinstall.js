import { PREFIX } from './constants.js';
import { readManifest } from './manifest.js';
import { findProjectRoot, ownPackage, packageRoot } from './project.js';
import path from 'node:path';

/**
 * Runs when this package is installed as a dependency. It touches nothing —
 * it only points at the command that does the work. Must never fail an install.
 */
function main() {
  const initCwd = process.env.INIT_CWD;

  if (!initCwd) return;                                   // npm told us nothing
  if (process.env.npm_config_global === 'true') return;   // global install
  if (path.resolve(initCwd) === path.resolve(packageRoot)) return; // own repo

  // A manifest means this project was scaffolded before, so this is an upgrade.
  // The version it records is the old one: node_modules already holds the new.
  const found = findProjectRoot(initCwd);
  const manifest = found ? readManifest(found.root) : null;

  if (manifest) {
    const now = ownPackage().version;
    const was = manifest.packageVersion; // null in manifests written before we recorded it
    const what = was === now ? `reinstalled ${now}` : `updated ${was ? `${was} -> ` : 'to '}${now}`;
    console.log(`${PREFIX} ${what} — run \`npx agentic-flow init\` to refresh`);
    return;
  }

  console.log(`${PREFIX} installed — run \`npx agentic-flow init\` to scaffold`);
}

try {
  main();
} catch {
  // Never fail an install.
}
