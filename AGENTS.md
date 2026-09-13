# agentic

Instructions for coding agents working in this repository.

## Overview

`agentic` is a zero-dependency npm package that scaffolds the agent layout of a
project. `npx agentic-flow init` creates `agentic/{skills,agents,hooks,tasks}`, seeds
the task pipeline (the `specificator` and `planner` subagents, the `spec` router
and `plan` skills, and the `jira` / `confluence` / `figma` source skills, to which
`agentic-flow source add` adds more),
writes a root `AGENTS.md`, and links `CLAUDE.md` and `.claude` at them. Installing the package touches nothing — `postinstall`
only prints the command to run. Everything init creates is idempotent, and
`agentic-flow reset` takes it back.

# Output Rules
- Be extremely concise. Get straight to the point.
- Avoid conversational filler, pleasantries, and introductory/concluding remarks.
- Use Markdown headers, short bullet points, and code blocks.
- Sacrifice unnecessary grammar for the sake of absolute concision

## Commands

| Task | Command |
| --- | --- |
| Scaffold / re-check this repo | `npx agentic-flow init` |
| Preview without writing | `node bin/agentic-flow.js init --dry-run` |
| Undo the scaffold | `node bin/agentic-flow.js reset --dry-run` |
| Declare a source | `node bin/agentic-flow.js source add <name> --matches <url-fragment>` |
| Syntax check | `node --check src/*.js bin/agentic-flow.js` |
| See what would ship | `npm pack --dry-run` |

No build step, no test runner. Verify by running the CLI against a throwaway
project: `npm init -y` in a temp dir, then `npm i -D file:/path/to/this/repo`.

## Conventions

- Node >= 18, ESM, **no runtime dependencies** — `node:*` builtins only.
- Nothing in `src/` overwrites or deletes a user file. Conflicts → warning with
  manual fix. `--force` only repoints a symlink.
- `src/postinstall.js` never fails an install and never edits the host
  `package.json`: every path exits 0.
- `reset` deletes only what `agentic/.agentic-manifest.json` records, never a
  directory recursively, never a file changed since init (without `--force`).
- Symlink targets relative — cloned repos stay portable.

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
| design | — (not connected) |

## Layout of agent material

Everything agent-related lives in `agentic/`:

- `agentic/skills/` — one directory per skill, each with a `SKILL.md`
- `agentic/agents/` — subagent definitions
- `agentic/hooks/` — hook scripts
- `agentic/tasks/` — one directory per ticket, see its README
- `agentic/settings.json` — project settings, reached as `.claude/settings.json`

`.claude` → `agentic/`, `CLAUDE.md` → this file. Tool-specific paths work
without duplicating content.
