---
name: figma
description: Record what a Figma design verifiably shows into agentic/tasks/<KEY>/sources/design.md. Use when the spec skill routes a design link here, or when asked to inventory a design for a ticket.
---

# Reading a design

A source skill. `spec` routes here with a link found in the ticket or in the
analytics document.

## Recognises

Host `figma.com` — `/file/`, `/design/`, `/proto/`, with or without a `node-id`.

## Role

`design`. The `MCP roles` table in `AGENTS.md` names the server that fills it.

Figma does not connect with a token like the others: it is either the Dev Mode
MCP server started from the Figma desktop app, or an OAuth connector authorised
with `/mcp`. If neither exists, the role is empty — see "Unavailable".

## Reads

Only what is **verifiable** in the file:

- screens and the states actually present on them
- copy strings, verbatim
- component names, tokens, spacing scale
- the `node-id` the link pointed at, when it has one

Nothing inferred. A state that is not drawn is not a state — it is a gap.

## Writes

`sources/design.md`:

```markdown
# Design — <file name>

**Ticket:** <ticket url>
**Source:** <figma url>
_fetched yy-mm-dd hh:mm_

## Screens

### <screen> — states present: default, empty
- copy: "…"
- components: …

## Not in the file

- error state, offline state, no-permission state
```

Several design links → one section per file, each with its own `**Source:**`.

## Hands back

Nothing. Links inside a design file are not followed — a design is the end of
the chain.

## Unavailable

No design server, or the file will not load → hand back `unavailable — <reason>`
so `spec` records it in `Sources`, and let the run continue without design. Never
describe screens you could not open, and never reconstruct them from the
analytics document — that is exactly the drift the snapshot exists to catch.

## Source

What `spec` routes by and what `agentic-flow` wires up. Keep it accurate.

| Field | Value |
| --- | --- |
| role | design |
| matches | figma.com |
| writes | sources/design.md |
| server | figma |
| auth | none |
| links | stop |
