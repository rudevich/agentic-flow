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

Your role is `tracker`. The `MCP roles` table in `AGENTS.md` says which MCP
server fills that role. Use that server's tools.

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

Write `sources/ticket.md`. Start it with the full ticket URL and the time you
read it.

```markdown
# PROJ-123 — <summary>

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

## What to report back

List every link that appears in the description or in the comments. Group them:

- a URL containing `/wiki/`, `/spaces/` or `/pages/` → for the `confluence` skill
- a URL containing `figma.com` → for the `figma` skill
- anything else → name it, and say you did not open it

Only report links that are written in the ticket. Never build a URL yourself and
never guess a host name.

## If you cannot read the ticket

Two cases, and both end the same way:

- there is no MCP server for the `tracker` role;
- the ticket URL does not load.

Say which of the two happened, and stop. Do not write `sources/ticket.md`. Never
describe a ticket you could not open, and never guess its contents from the key.

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
