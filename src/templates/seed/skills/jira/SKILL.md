---
name: jira
description: Read a Jira ticket into agentic/tasks/<KEY>/sources/ticket.md and report the Confluence and Figma links it contains. Use when the spec skill sends a tracker link here, or when asked to save a copy of a ticket.
---

# Read a ticket

You are given one ticket URL. You copy what the ticket says into a file. You
report the links you found in it. You do nothing else.

The `spec` skill calls you first, because every specification starts from a
ticket.

## Which URLs are yours

A ticket URL contains `/browse/` or `selectedIssue=`. The ticket key is the part
that looks like `PROJ-123`.

| URL | key |
| --- | --- |
| `https://co.atlassian.net/browse/PROJ-123` | `PROJ-123` |
| `https://co.atlassian.net/jira?selectedIssue=PROJ-123` | `PROJ-123` |

If the URL has no key anywhere, it is not a ticket. Say so and stop.

## Which tool to use

Your role is `tracker`. Open `AGENTS.md`, find the `MCP roles` table, and read
the server name on the `tracker` row. Use that server's tools.

Do not use `WebFetch`. Jira requires a login. `WebFetch` would return the login
page, and a login page looks like a ticket with nothing in it. You would then
write an empty specification and not notice.

## What to copy

1. The fields that carry meaning: summary, type, status, labels, components, fix
   version.
2. The description, word for word.
3. Comments that decide something: a rule, a number, an option that was rejected.

Skip comments that decide nothing, such as "looks good to me".

## What to write

Write one file: `sources/ticket.md`. Copy the shape below.

```markdown
# PROJ-123 — <ticket summary>

**Ticket:** https://co.atlassian.net/browse/PROJ-123
_fetched 2026-09-13 14:20_

## Fields

| Field | Value |
| --- | --- |
| Status | In progress |

## Description

<the description, word for word>

## Decisions in comments

- <author> — <what was decided>
```

Use the current date and time. Do not copy the example.

Replace every `<…>` with a real value. No angle brackets may remain in what you
write.

## What to report back

Answer `spec` in exactly this shape, and nothing else:

```
written: agentic/tasks/PROJ-123/sources/ticket.md
links:
- https://co.atlassian.net/wiki/spaces/PROD/pages/12345 -> confluence
- https://www.figma.com/design/abc123/Checkout -> figma
- https://dashboard.internal/metrics -> not recognised, not opened
```

How to fill the `links` list:

| The URL contains | Write after the arrow |
| --- | --- |
| `/wiki/`, `/spaces/` or `/pages/` | `confluence` |
| `figma.com` | `figma` |
| anything else | `not recognised, not opened` |

List every link that appears in the description or in the comments. If there are
none, write `links: none`.

Only report links that are written in the ticket. Never build a URL yourself and
never guess a host name.

## If you cannot read the ticket

Two cases, and both end the same way:

- there is no MCP server for the `tracker` role;
- the ticket URL does not load.

Write no file. Answer in this shape:

```
written: none
reason: no MCP server for the tracker role
```

Never describe a ticket you could not open, and never guess its contents from
the key.

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
