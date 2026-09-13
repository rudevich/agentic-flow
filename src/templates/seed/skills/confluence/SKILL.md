---
name: confluence
description: Snapshot a Confluence page into agentic/tasks/<KEY>/sources/analytics.md and hand back the Figma links it carries. Use when the spec skill routes an analytics link here, or when asked to snapshot an analytics document on its own.
---

# Reading an analytics document

A source skill. `spec` routes here with a link **found in the ticket** — it never
searches for a page by title.

## Recognises

Path contains `/wiki/`, `/spaces/` or `/pages/`.

## Role

`docs`. The `MCP roles` table in `AGENTS.md` names the server that fills it — use
that server's tools. Never `WebFetch`: the page is behind auth, and a login page
reads like an empty document.

## Reads

The page text as it stands. Tables, lists and acceptance criteria are content,
not decoration — keep their structure. Keep section numbering: requirements cite
it later as `analytics §2.1`.

Child pages are followed only when the page links to them explicitly as part of
the specification.

## Writes

`sources/analytics.md`:

```markdown
# Analytics — <page title>

**Ticket:** <ticket url>
**Source:** <page url>
_fetched yy-mm-dd hh:mm_

<the page, structure preserved>
```

More than one analytics page → one section per page in the same file, each with
its own `**Source:**` and fetch time.

## Hands back

Figma links found on the page → `figma`. Other links: name them, do not open them.

## Unavailable

No docs server, or the page will not load → do not guess what it said. Hand back
`unavailable — <reason>` so `spec` records it in `Sources`, and let the run
continue on the ticket alone. Whatever the page would have answered belongs in
`Missing in sources`, not in a requirement.

## Source

What `spec` routes by and what `agentic-flow` wires up. Keep it accurate.

| Field | Value |
| --- | --- |
| role | docs |
| matches | /wiki/, /spaces/, /pages/ |
| writes | sources/analytics.md |
| server | confluence, atlassian |
| auth | token |
| links | follow |
