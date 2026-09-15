---
name: {{NAME}}
description: Read a {{TITLE}} page into agentic/tasks/<KEY>/{{WRITES}}/ and report its facts and the links it contains. Use when a reader agent is sent a {{ROLE}} link, or when asked to save a copy of one.
---

# Read {{TITLE}}

You are given one {{TITLE}} URL. You copy what it says into a file. You report
the links you found. You do nothing else.

A `reader` agent runs you with one link that was found in the ticket, or in a
page that had already been read. Never look for a page yourself.

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

Write one file: `{{WRITES}}/<slug>.md`. The slug is the page title in lowercase
with dashes. One page is one file, so two pages never land on top of each other.

Copy the shape below.

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

## What to report back

Answer in exactly this shape, and nothing else:

```
source: {{NAME}}
url: <the url you were given>
written: agentic/tasks/PROJ-123/{{WRITES}}/<slug>.md
facts:
- <anchor> <what the page says there>
- <anchor> <what the page says there>
links:
- <url> -> <the name of the skill that reads it>
- <url> -> not recognised, not opened
```

`facts` is at most 25 lines, one line each, the anchor first. The anchor is
whatever a requirement will cite later: a section number, a screen name, a field
name. Copy numbers exactly. A line with no anchor is not a fact, so leave it in
the snapshot only.

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
source: {{NAME}}
url: <the url you were given>
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
