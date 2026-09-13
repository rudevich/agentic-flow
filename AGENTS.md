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
| Syntax check | `node --check src/*.js bin/agentic-flow.js` |
| See what would ship | `npm pack --dry-run` |

No build step. `npm test` is `node --test`, which finds `src/tests/*.test.js` by
itself.

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

| File | What belongs in it |
| --- | --- |
| `constants.js` | every name the package writes into a project, and every marker it owns inside a file it does not. Imports nothing but `node:path`. |
| `utils.js` | small helpers with no opinion about the scaffold: `hash`, `readJson`, `readTemplate`, `fill`, `nodeAtLeast`. |
| `fsx.js` | everything that touches the filesystem and reports it. |
| `project.js` | where the package is, where the project is. Imports nothing of ours, so it can never close a cycle. |

Put a literal in `constants.js` the moment a second file needs it. Put a helper
in `utils.js` the moment a second file would copy it. A path or a marker spelled
out in two modules is a bug waiting for one of them to change.

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
- `src/postinstall.js` never fails an install and never edits the host
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
