# agentic

Instructions for coding agents working in this repository.

## Overview

`agentic` is a zero-dependency npm package that scaffolds the agent layout of a
project.

`npx @rudevich/agentic-flow init` does four things. It creates
`agentic/{skills,agents,hooks,tasks}`. It seeds the task pipeline: the
`reader`, `part-reader`, `specificator`, `planner` and `designer` subagents, the
`spec`, `plan` and `design` router skills, and the `jira` / `confluence` /
`figma` source skills, to which `agentic-flow source add` adds more. It writes a root `AGENTS.md`. It links `CLAUDE.md` and `.claude`
at them.

Installing the package touches nothing. `postinstall` only prints the command to
run. Everything init creates is idempotent, and `agentic-flow reset` takes it
back.

# Output Rules
- Be extremely concise. Get straight to the point.
- Avoid conversational filler, pleasantries, and introductory/concluding remarks.
- Use Markdown headers, short bullet points, and code blocks.
- Sacrifice unnecessary grammar for the sake of absolute concision

## Commands

| Task | Command |
| --- | --- |
| Run the tests | `npm test` |
| Scaffold / re-check this repo | `node bin/agentic-flow.ts init` |
| Preview without writing | `node bin/agentic-flow.ts init --dry-run` |
| Undo the scaffold | `node bin/agentic-flow.ts reset --dry-run` |
| Declare a source | `node bin/agentic-flow.ts source add <name> --matches <url-fragment>` |
| Type-check | `npm run typecheck` |
| Build `dist/` | `npm run build` |
| See what would ship | `npm pack --dry-run` |

**TypeScript, run as it is.** Node 24 strips the types itself, so in this
repository there is no build before running anything. `npm test` is
`node --test`, which finds every `src/tests/**/*.test.ts` by itself, subfolders
included. Stripping checks nothing, so `npm run typecheck` is a separate step:
run both.

**One build, for publishing.** Node refuses to strip types under `node_modules`,
so the package ships `dist/`, compiled by `tsc -p tsconfig.build.json`. `prepare`
runs it after `npm install` and before `npm pack`. `dist/` is never committed.

**TypeScript 6, not 7.** TypeScript 7 is a native compiler and ships no
`tsserver.js`, so no editor can use it as the workspace version. TypeScript 6 is
the same language and does ship one. `.vscode/settings.json` points VS Code at
it. An editor left on its own bundled TypeScript older than 5.0 reports every
`.ts` import as error TS2691.

Write only syntax Node can erase: no `enum`, no `namespace`, no parameter
properties. `erasableSyntaxOnly` rejects them. Import local modules with their
`.ts` extension, which the build rewrites to `.js`, and types with `import type`.

**Node 24 or newer, and nothing older.** `engines` says so, and the CLI checks it
on every run in `bin/agentic-flow.ts`. That check exists because `engines` only
makes npm warn, and `npx` skips even that. Write for that Node: `fs.globSync` and
friends are the platform, not something to hand-roll. `MIN_NODE_MAJOR` in
`src/constants.ts` and `engines` in `package.json` must agree, and a test asserts
it.

Behaviour that tests cannot reach, such as symlinks, prompts and a real npm
install, is verified against a throwaway project. Pack this repository with
`npm pack --pack-destination <dir>`, run `npm init -y` in a temp dir, install
the tarball, and run `node node_modules/@rudevich/agentic-flow/dist/bin/agentic-flow.js`.
Installing the tarball is what proves `dist/` and `files` are right; a `file:`
link to this directory proves neither.

## Where things live in `src/`

Four layers. Each one reaches downwards only, and
`src/tests/layers.test.ts` fails the build if that stops being true.

| Layer | Files | What belongs in it |
| --- | --- | --- |
| foundation | `constants.ts`, `utils.ts`, `project.ts` | names and markers, pure helpers, and where the package and the project are. These import nothing of ours. |
| `platform/` | `fsx.ts`, `color.ts`, `prompt.ts` | everything that touches the filesystem, the terminal or stdin. `Reporter` and the write options live in `fsx.ts`. |
| `model/` | `manifest.ts`, `sources.ts`, `mcp.ts`, `docs.ts` | what the package knows: what it wrote, what a source declares, which server fills a role, which block of a document is ours. |
| `commands/` | `init.ts`, `reset.ts`, `source.ts`, `postinstall.ts`, `connect.ts` | one file per CLI verb, plus the text those verbs print. `init.ts` holds both `init` and `config`. |

A type lives beside the code that owns it, never in a shared `types.ts`: the
`Source` type in `sources.ts`, `ManifestEntry` in `manifest.ts`. Type imports
count as imports, so they follow the same downward rule.

`src/tests/` mirrors those folders, and every module has a test in the matching
one.

Put a literal in `constants.ts` the moment a second file needs it. Put a helper
in `utils.ts` the moment a second file would copy it. A path or a marker spelled
out in two modules is a bug waiting for one of them to change.

`project.ts` sits in the foundation and imports nothing of ours on purpose.
`utils.ts` needs `packageRoot` from it, so anything it imported would be reachable
from every layer.

## Documents under `src/templates/`

These are instructions that a model executes, sometimes a weak one. They are held
to a contract that `src/tests/templates.test.ts` enforces:

- a file that shows a timestamp also carries the sentence
  `Use the current date and time. Do not copy the example.`
- a file with `<…>` placeholders carries the matching sentence about replacing
  every one of them
- source skills carry their seven sections in order, ending with `## Source`
- router skills end with a `- [ ]` checklist, and each line names the step or
  rule it checks
- calling another skill is written as a tool call, never as "load"
- no sentence over 25 words outside code fences and tables

## Conventions

- Node >= 24, ESM, TypeScript under `strict` and `noUncheckedIndexedAccess`.
- **No runtime dependencies**: `node:*` builtins only. `typescript` and
  `@types/node` are devDependencies and never reach an installed project.
- JSON read from disk is a claim, not a fact. `readJson<T>` types it, and every
  field of `T` stays optional until something checks it.
- Nothing in `src/` overwrites or deletes a user file. A generated file is
  rewritten only while it still matches its hash in the manifest, byte for byte
  what we wrote. A conflict produces a warning with a manual fix. `--force` only
  repoints a symlink.
- `src/commands/postinstall.ts` never fails an install and never edits the host
  `package.json`: every path exits 0. The `postinstall` script imports it from
  `dist/` and swallows a failure, because in this repository `dist/` does not
  exist yet when npm runs it.
- `reset` deletes only what `agentic/.agentic-manifest.json` records. It never
  removes a directory recursively, and never a file changed since init unless
  `--force` is given.
- Symlink targets are relative, so cloned repos stay portable.

## Documents

<!-- agentic:doc-language -->
Write every document you generate in English, whatever the language of the request.

## MCP roles

Which server the agents reach for. Regenerate with `agentic-flow config`.

<!-- agentic:mcp-roles -->
| Role | Server |
| --- | --- |
| tracker | `jira` |
| docs | `confluence` |
| design | — (links only) |

## Layout of agent material

Everything agent-related lives in `agentic/`:

| Directory | What is in it |
| --- | --- |
| `agentic/skills/` | one directory per skill, each with a `SKILL.md` |
| `agentic/agents/` | subagent definitions |
| `agentic/hooks/` | hook scripts |
| `agentic/tasks/` | one directory per ticket, see its README |
| `agentic/settings.json` | project settings, reached as `.claude/settings.json` |

`.claude` is a symlink to `agentic/`, and `CLAUDE.md` is a symlink to this file.
Tool-specific paths work without duplicating content.
