# {{PROJECT_NAME}}

Instructions for coding agents working in this repository.

## Overview

<!-- What this project is, in two or three sentences. -->

## Commands

| Task  | Command |
| ----- | ------- |
| Install | `npm install` |
| Test    | `npm test` |

## Conventions

<!-- What an agent cannot infer from the code: naming rules, layout rules,
     libraries to prefer or avoid, things that must never be touched. -->

## Documents

<!-- agentic:doc-language -->
{{DOC_LANGUAGE}}

## MCP roles

Which server the agents reach for. Regenerate with `agentic-flow config`.

<!-- agentic:mcp-roles -->
{{MCP_ROLES}}

## Layout of agent material

Everything agent-related lives in `agentic/`:

- `agentic/skills/` — one directory per skill, each with a `SKILL.md`
- `agentic/agents/` — subagent definitions
- `agentic/hooks/` — hook scripts
- `agentic/tasks/` — one directory per ticket, see its README

`.claude` → `agentic/`, `CLAUDE.md` → this file. Tool-specific paths work
without duplicating content.
