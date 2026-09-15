---
name: confluence
description: Copy a Confluence page into agentic/tasks/<KEY>/sources/analytics/ and report its facts and the Figma links it contains. Use when a reader agent is sent an analytics link, or when asked to save a copy of an analytics document.
---

# Read an analytics document

You are given one Confluence URL. You copy the page into a file. You report the
links you found on it. You do nothing else.

A `reader` agent runs you with one link that was found **inside the ticket**.
Never look for a page yourself.

## Which URLs are yours

A Confluence URL contains `/wiki/`, `/spaces/` or `/pages/`.

## Which tool to use

Your role is `docs`. Open `AGENTS.md`, find the `MCP roles` table, and read the
server name on the `docs` row. Use that server's tools.

Do not use `WebFetch`. The page requires a login. `WebFetch` would return the
login page, and you would copy an empty document without noticing.

## What to copy

Copy the text of the page as it is now.

Keep the structure: tables stay tables, lists stay lists, acceptance criteria
stay in the order they were written. Keep the section numbers. Requirements will
point at them later, like `analytics §2.1`.

Open a child page only if this page links to it as part of the specification.

## What to write

Write one file: `sources/analytics/<slug>.md`. The slug is the page title in
lowercase with dashes, for example `sources/analytics/checkout-flow.md`. One page
is one file, so two pages never land on top of each other.

Copy the shape below.

```markdown
# Analytics — <page title>

**Ticket:** https://co.atlassian.net/browse/PROJ-123
**Source:** https://co.atlassian.net/wiki/spaces/PROD/pages/12345
_fetched 2026-09-13 14:20_

<the page, structure kept>
```

Use the current date and time. Do not copy the example.

Replace every `<…>` with a real value. No angle brackets may remain in what you
write.

## What to report back

Answer in exactly this shape, and nothing else:

```
source: confluence
url: https://co.atlassian.net/wiki/spaces/PROD/pages/12345
written: agentic/tasks/PROJ-123/sources/analytics/checkout-flow.md
facts:
- §2.1 a cart keeps its items for 30 days
- §3.4 guest checkout is out of scope for this release
links:
- https://www.figma.com/design/abc123/Checkout -> figma
- https://dashboard.internal/metrics -> not recognised, not opened
```

`facts` is at most 25 lines, one line each, the section number first. Copy
numbers exactly: "30 days" stays "30 days". A line with no section number is not
a fact, so leave it in the snapshot only. Do not turn a fact into a requirement:
that is the specificator's job.

How to fill the `links` list:

| The URL contains | Write after the arrow |
| --- | --- |
| `figma.com` | `figma` |
| anything else | `not recognised, not opened` |

If the page carries no links, write `links: none`.

Only report links that are written on the page. Never build a URL yourself.

## If you cannot read the page

Two cases, and both end the same way:

- there is no MCP server for the `docs` role;
- the page URL does not load.

Write no file. Answer in this shape:

```
source: confluence
url: https://co.atlassian.net/wiki/spaces/PROD/pages/12345
written: none
reason: the page URL does not load
```

Do not guess what the page said. Your reason goes into the `Sources` table of
`requirements.md`, and the run carries on without this page.

Whatever this page would have answered is now unknown. It belongs under
`Missing in sources` in `requirements.md`, not in a requirement.

## Source

What `spec` routes by and what `agentic-flow` wires up. Keep it accurate.

| Field | Value |
| --- | --- |
| role | docs |
| matches | /wiki/, /spaces/, /pages/ |
| writes | sources/analytics |
| server | confluence, atlassian |
| auth | token |
| links | follow |
