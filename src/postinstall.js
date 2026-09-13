import { PREFIX } from './fsx.js';
import { packageRoot } from './project.js';
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

  console.log(`${PREFIX} installed — run \`npx agentic-flow init\` to scaffold`);
}

try {
  main();
} catch {
  // Never fail an install.
}
