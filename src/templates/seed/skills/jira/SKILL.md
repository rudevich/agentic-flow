---
name: jira
description: Read a Jira ticket into agentic/tasks/<KEY>/sources/ticket.md and hand back the Confluence and Figma links it carries. Use when the spec skill routes a tracker link here, or when asked to snapshot a ticket on its own.
---

# Reading a ticket

A source skill. `spec` routes here first, because the ticket is the entry point of
every specification.

## Recognises

| URL | `<KEY>` |
| --- | --- |
| `…/browse/PROJ-123` | `PROJ-123` |
| `…?selectedIssue=PROJ-123` | `PROJ-123` |
| a key `[A-Z][A-Z0-9]*-\d+` anywhere in the URL | that key |

No key anywhere → this is not a ticket. Say so and stop.

## Role

`tracker`. The `MCP roles` table in `AGENTS.md` names the server that fills it —
use that server's tools. Never `WebFetch`: Jira sits behind auth and returns a
login page, which reads exactly like an empty ticket.

## Reads

- fields that carry intent: summary, type, status, labels, components, fix version
- the description, verbatim
- comments that **decide** something — a rule, a number, a rejected option. Not
  the chatter around them.

## Writes

`sources/ticket.md`:

```markdown
# <KEY> — <summary>

**Ticket:** <full url>
_fetched yy-mm-dd hh:mm_

## Fields

| Field | Value |
| --- | --- |

## Description

<verbatim>

## Decisions in comments

- <author> — <what was decided>
```

## Hands back

Every link that appears in the description or in the comments, grouped by what it
is:

- `/wiki/`, `/spaces/`, `/pages/` → `confluence`
- `figma.com` → `figma`
- anything else → name it, do not open it

Report links, never build them. A URL that is not in the text does not exist.

## Unavailable

No tracker server, or the ticket will not load → say which of the two and
**stop**. Without the ticket there is nothing to specify, and its contents are
never guessed from the key.

## Source

What `spec` routes by and what `agentic-flow` wires up. Keep it accurate.

| Field | Value |
| --- | --- |
| role | tracker |
| matches | /browse/, selectedIssue= |
| writes | sources/ticket.md |
| server | jira, atlassian |
| auth | token |
| links | follow |
