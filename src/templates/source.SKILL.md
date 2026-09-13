---
name: {{NAME}}
description: Read a {{TITLE}} page into agentic/tasks/<KEY>/{{WRITES}} and report the links it contains. Use when the spec skill sends a {{ROLE}} link here, or when asked to save a copy of one.
---

# Read {{TITLE}}

You are given one {{TITLE}} URL. You copy what it says into a file. You report
the links you found. You do nothing else.

The `spec` skill gives you a link it found in the ticket, or in a page it had
already read. Never look for a page yourself.

## Which URLs are yours

A URL containing any of: {{MATCHES}}

## Which tool to use

Your role is `{{ROLE}}`. The `MCP roles` table in `AGENTS.md` says which MCP
server fills that role. Use that server's tools.

If the page requires a login, do not use `WebFetch`. It would return the login
page, and a login page looks like a page with nothing in it.

## What to copy

<!-- TODO: answer two questions here.
     1. What do you pull out of this page? Name the parts.
     2. What do you leave behind?
     Keep the structure that requirements will point at later: section numbers,
     table rows, text word for word. -->

## What to write

Write `{{WRITES}}`. Start it with the ticket URL, the page URL and the time you
read it.

```markdown
# {{TITLE}} — <title>

**Ticket:** https://co.atlassian.net/browse/PROJ-123
**Source:** <url>
_fetched 2026-09-13 14:20_

<the page>
```

If you were given more than one link of this kind, put one section per page in
this same file. Each section gets its own `**Source:**` line.

## What to report back

<!-- TODO: answer one question here.
     Which links found on this page should be opened by another source skill?
     If none, write "Nothing. The chain of sources ends here." and set
     `links` to `stop` in the table below. -->

Only report links that are written on the page. Never build a URL yourself.

## If you cannot read the page

Two cases:

- there is no MCP server for the `{{ROLE}}` role;
- the URL does not load.

Report `unavailable — <reason>` back to `spec`, which writes that into the
`Sources` table. The run continues without this source.

Never describe a page you could not open. Never rebuild it from the other
sources. What this page would have answered belongs under `Missing in sources`.

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
