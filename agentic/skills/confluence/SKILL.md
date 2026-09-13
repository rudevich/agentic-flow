---
name: confluence
description: Copy a Confluence page into agentic/tasks/<KEY>/sources/analytics.md and report the Figma links it contains. Use when the spec skill sends an analytics link here, or when asked to save a copy of an analytics document.
---

# Read an analytics document

You are given one Confluence URL. You copy the page into a file. You report the
links you found on it. You do nothing else.

The `spec` skill gives you a link it found **inside the ticket**. Never look for
a page yourself.

## Which URLs are yours

A Confluence URL contains `/wiki/`, `/spaces/` or `/pages/`.

## Which tool to use

Your role is `docs`. The `MCP roles` table in `AGENTS.md` says which MCP server
fills that role. Use that server's tools.

Do not use `WebFetch`. The page requires a login. `WebFetch` would return the
login page, and you would copy an empty document without noticing.

## What to copy

Copy the text of the page as it is now.

Keep the structure: tables stay tables, lists stay lists, acceptance criteria
stay in the order they were written. Keep the section numbers. Requirements will
point at them later, like `analytics §2.1`.

Open a child page only if this page links to it as part of the specification.

## What to write

Write `sources/analytics.md`. Start it with the ticket URL, the page URL and the
time you read it.

```markdown
# Analytics — <page title>

**Ticket:** https://co.atlassian.net/browse/PROJ-123
**Source:** https://co.atlassian.net/wiki/spaces/PROD/pages/12345
_fetched 2026-09-13 14:20_

<the page, structure kept>
```

If you were given more than one analytics page, put one section per page in this
same file. Each section gets its own `**Source:**` line and its own fetch time.

## What to report back

List every `figma.com` link on the page. Those go to the `figma` skill.

Name any other links you saw, and say you did not open them.

Only report links that are written on the page. Never build a URL yourself.

## If you cannot read the page

Two cases:

- there is no MCP server for the `docs` role;
- the page URL does not load.

Do not guess what the page said. Report `unavailable — <reason>` back to `spec`,
which writes that into the `Sources` table. The run continues with the ticket
alone.

Whatever this page would have answered is now unknown. It belongs under
`Missing in sources` in `requirements.md`, not in a requirement.

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
