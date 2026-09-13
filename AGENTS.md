# agentic

Instructions for coding agents working in this repository.

## Overview

`agentic` is a zero-dependency npm package that scaffolds the agent layout of a
project.

`npx agentic-flow init` does four things. It creates
`agentic/{skills,agents,hooks,tasks}`. It seeds the task pipeline: the
`specificator` and `planner` subagents, the `spec` router and `plan` skills, and
the `jira` / `confluence` / `figma` source skills, to which `agentic-flow source
add` adds more. It writes a root `AGENTS.md`. It links `CLAUDE.md` and `.claude`
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
| Scaffold / re-check this repo | `npx agentic-flow init` |
| Preview without writing | `node bin/agentic-flow.js init --dry-run` |
| Undo the scaffold | `node bin/agentic-flow.js reset --dry-run` |
| Declare a source | `node bin/agentic-flow.js source add <name> --matches <url-fragment>` |
| Syntax check | `node --check bin/agentic-flow.js && find src -name '*.js' -exec node --check {} \;` |
| See what would ship | `npm pack --dry-run` |

No build step. `npm test` is `node --test`, which finds every
`src/tests/**/*.test.js` by itself, subfolders included.

**Node 24 or newer, and nothing older.** `engines` says so, and the CLI checks it
on every run in `bin/agentic-flow.js`. That check exists because `engines` only
makes npm warn, and `npx` skips even that. Write for that Node: `fs.globSync` and
friends are the platform, not something to hand-roll. `MIN_NODE_MAJOR` in
`src/constants.js` and `engines` in `package.json` must agree, and a test asserts
it.

Behaviour that tests cannot reach, such as symlinks, prompts and a real npm
install, is verified against a throwaway project. Run `npm init -y` in a temp
dir, then `npm i -D file:/path/to/this/repo`.

## Where things live in `src/`

Four layers. Each one reaches downwards only, and
`src/tests/layers.test.js` fails the build if that stops being true.

| Layer | Files | What belongs in it |
| --- | --- | --- |
| foundation | `constants.js`, `utils.js`, `project.js` | names and markers, pure helpers, and where the package and the project are. These import nothing of ours. |
| `platform/` | `fsx.js`, `color.js`, `prompt.js` | everything that touches the filesystem, the terminal or stdin. |
| `model/` | `manifest.js`, `sources.js`, `mcp.js`, `docs.js` | what the package knows: what it wrote, what a source declares, which server fills a role, which block of a document is ours. |
| `commands/` | `init.js`, `reset.js`, `source.js`, `postinstall.js`, `connect.js` | one file per CLI verb, plus the text those verbs print. `init.js` holds both `init` and `config`. |

`src/tests/` mirrors those folders, and every module has a test in the matching
one.

Put a literal in `constants.js` the moment a second file needs it. Put a helper
in `utils.js` the moment a second file would copy it. A path or a marker spelled
out in two modules is a bug waiting for one of them to change.

`project.js` sits in the foundation and imports nothing of ours on purpose.
`utils.js` needs `packageRoot` from it, so anything it imported would be reachable
from every layer.

## Documents under `src/templates/`

These are instructions that a model executes, sometimes a weak one. They are held
to a contract that `src/tests/templates.test.js` enforces:

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

- Node >= 24, ESM, **no runtime dependencies**. `node:*` builtins only.
- Nothing in `src/` overwrites or deletes a user file. A generated file is
  rewritten only while it still matches its hash in the manifest, byte for byte
  what we wrote. A conflict produces a warning with a manual fix. `--force` only
  repoints a symlink.
- `src/commands/postinstall.js` never fails an install and never edits the host
  `package.json`: every path exits 0.
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
| design | `plugin:product-management:figma` |

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
