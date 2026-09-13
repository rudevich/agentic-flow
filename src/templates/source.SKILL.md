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

Your role is `{{ROLE}}`. Open `AGENTS.md`, find the `MCP roles` table, and read
the server name on the `{{ROLE}}` row. Use that server's tools.

If the page requires a login, do not use `WebFetch`. It would return the login
page, and a login page looks like a page with nothing in it.

## What to copy

<!-- TODO: answer two questions here.
     1. What do you pull out of this page? Name the parts.
     2. What do you leave behind?
     Keep the structure that requirements will point at later: section numbers,
     table rows, text word for word. -->

## What to write

Write one file: `{{WRITES}}`. Copy the shape below.

```markdown
# {{TITLE}} — <page title>

**Ticket:** https://co.atlassian.net/browse/PROJ-123
**Source:** <the url you were given>
_fetched 2026-09-13 14:20_

<the page>
```

Use the current date and time. Do not copy the example.

Replace every `<…>` with a real value. No angle brackets may remain in what you
write.

If you were given more than one link of this kind, put one section per page in
this same file. Each section gets its own `**Source:**` line.

## What to report back

Answer `spec` in exactly this shape, and nothing else:

```
written: agentic/tasks/PROJ-123/{{WRITES}}
links:
- <url> -> <the name of the skill that reads it>
- <url> -> not recognised, not opened
```

<!-- TODO: answer one question here.
     Which links found on this page should be opened by another source skill?
     Write one table row per kind, the way the jira skill does it.
     If none, write "links is always none" and set `links` to `stop` in the
     table at the end of this file. -->

If the page carries no links, write `links: none`.

Only report links that are written on the page. Never build a URL yourself.

## If you cannot read the page

Two cases, and both end the same way:

- there is no MCP server for the `{{ROLE}}` role;
- the URL does not load.

Write no file. Answer in this shape:

```
written: none
reason: no MCP server for the {{ROLE}} role
```

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
