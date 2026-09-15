#!/usr/bin/env node
import { MIN_NODE_MAJOR, PREFIX } from '../src/constants.js';
import { config, init } from '../src/commands/init.js';
import { ownPackage } from '../src/project.js';
import { reset } from '../src/commands/reset.js';
import { addSource } from '../src/commands/source.js';
import { nodeAtLeast } from '../src/utils.js';

if (!nodeAtLeast(MIN_NODE_MAJOR)) {
  console.error(`${PREFIX} needs Node ${MIN_NODE_MAJOR} or newer — this is ${process.versions.node}`);
  process.exit(1);
}

const HELP = `
  agentic-flow — scaffold agent material for a project

  Usage
    agentic-flow init [--dry-run] [--force] [--lang <lang>]
    agentic-flow config                 re-scan the connected MCP servers
    agentic-flow source add <name>      declare one more source to read from
    agentic-flow reset [options]        undo what init created

  init
    --dry-run    print what would be created, write nothing
    --force      repoint a symlink that points somewhere unexpected
    --lang       english | request — the language agents write documents in
                 (default: the language of the request; only --lang changes
                 a setting AGENTS.md already carries)

  config
    --dry-run    print what would change, write nothing
    --lang       english | request

  source add <name>
    --role       the role it fills, any name you like   (default docs)
    --matches    URL fragments that identify it, comma-separated
    --writes     the directory it snapshots into        (default sources/<name>)
    --server     its MCP server name                    (default <name>)
    --auth       token | none                           (default token)
    --links      follow | stop — whether its links lead on to other sources
    --dry-run    print what would be created, write nothing

  reset
    --dry-run    print what would be removed, delete nothing
    --yes        skip the confirmation prompt
    --force      also remove files changed since init, and ignore a dirty tree
    --all        also remove agentic/ entirely, including your own content
    --secrets    also remove .env.agentic

  Common
    -h, --help
    -v, --version
`;

const argv = process.argv.slice(2);
const has = (...flags) => flags.some((flag) => argv.includes(flag));

if (has('-v', '--version')) {
  console.log(ownPackage().version);
  process.exit(0);
}

const words = argv.filter((arg) => !arg.startsWith('-'));
const [command] = words;

/** `--role docs` — the flags above take a value, unlike the plain switches. */
const value = (flag) => {
  const at = argv.indexOf(flag);
  const next = at === -1 ? undefined : argv[at + 1];
  return next && !next.startsWith('-') ? next : undefined;
};

if (has('-h', '--help') || !command) {
  console.log(HELP);
  process.exit(0);
}

const COMMANDS = {
  init: () => init({ dryRun: has('--dry-run'), force: has('--force'), lang: value('--lang') }),
  config: () => config({ dryRun: has('--dry-run'), lang: value('--lang') }),
  source: () => {
    const [sub, name] = words.slice(1);
    if (sub !== 'add') {
      console.error(`${PREFIX} usage: agentic-flow source add <name>`);
      process.exit(1);
    }
    return addSource({
      name,
      dryRun: has('--dry-run'),
      role: value('--role'),
      matches: value('--matches'),
      writes: value('--writes'),
      server: value('--server'),
      auth: value('--auth'),
      links: value('--links'),
    });
  },
  reset: () =>
    reset({
      dryRun: has('--dry-run'),
      yes: has('--yes'),
      force: has('--force'),
      secrets: has('--secrets'),
      all: has('--all'),
    }),
};

if (!COMMANDS[command]) {
  console.error(`${PREFIX} unknown command: ${command}`);
  console.log(HELP);
  process.exit(1);
}

try {
  await COMMANDS[command]();
} catch (error) {
  console.error(`${PREFIX} ${error.message}`);
  process.exit(1);
}
