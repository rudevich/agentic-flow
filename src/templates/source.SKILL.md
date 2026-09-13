---
name: {{NAME}}
description: Read a {{TITLE}} page into agentic/tasks/<KEY>/{{WRITES}} and hand back the links it carries. Use when the spec skill routes a {{ROLE}} link here, or when asked to snapshot one on its own.
---

# Reading {{TITLE}}

A source skill. `spec` routes here with a link found in the ticket or in a
document already read — it never searches for a page by title.

## Recognises

A URL containing: {{MATCHES}}

## Role

`{{ROLE}}`. The `MCP roles` table in `AGENTS.md` names the server that fills it —
use that server's tools. Never `WebFetch` a page behind auth: a login page reads
exactly like an empty one.

## Reads

<!-- TODO: what to pull out, and what to leave. Keep the structure requirements
     will cite later — section numbers, table rows, verbatim copy. -->

## Writes

`{{WRITES}}`, opening with the ticket URL and the time you fetched the page:

```markdown
# {{TITLE}} — <title>

**Ticket:** <ticket url>
**Source:** <url>
_fetched yy-mm-dd hh:mm_

<the page>
```

Several links of this kind → one section per page in the same file, each with
its own `**Source:**`.

## Hands back

<!-- TODO: which links found here are worth following — or "nothing", if this is
     the end of the chain. Set `links` below to match. -->

## Unavailable

No `{{ROLE}}` server, or the page will not load → hand back
`unavailable — <reason>` so `spec` records it in `Sources`, and let the run
continue without it. Never describe a page you could not open, and never
reconstruct it from the other sources.

## Source

What `spec` routes by and what `agentic-flow` wires up. Keep it accurate.

| Field | Value |
| --- | --- |
| role | {{ROLE}} |
| matches | {{MATCHES}} |
| writes | {{WRITES}} |
| server | {{SERVER}} |
| auth | {{AUTH}} |
| links | {{LINKS}} |
