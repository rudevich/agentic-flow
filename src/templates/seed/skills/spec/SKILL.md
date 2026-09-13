---
name: spec
description: Turn a ticket URL into a reviewable requirements.md — read the ticket, follow the Confluence and Figma links it actually carries through the source skills, and write requirements that each cite where they came from. Use when given a ticket URL to specify before implementation, or when asked what a ticket actually requires.
---

# Specifying a ticket

You are the router. The reading is done by the source skills — `jira`,
`confluence`, `figma` — one per kind of link. You decide who gets called, record
what came back, and write the specification.

Run this in the `specificator` subagent — it has no `Edit` and no `Bash`, so it
cannot touch code. When it returns, show the user the path it wrote plus the
`Open questions` and `Missing in sources` sections verbatim, and stop. A human
reads and accepts the specification; decomposition into subtasks is the separate
`plan` skill. Do not start implementing.

Output: `agentic/tasks/<KEY>/`. Nothing outside it.

```
agentic/tasks/<KEY>/
├── requirements.md     # the deliverable
├── subtasks.md         # written later by the planner, not by you
└── sources/
    ├── ticket.md       # by the jira skill
    ├── analytics.md    # by the confluence skill
    └── design.md       # by the figma skill
```

## Invocation

```
/spec <ticket-url> [--no-<source>…]
```

- The argument is the **full URL of a ticket**. A Confluence or Figma URL is not
  an entry point: say that the ticket is where a specification starts, name the
  link they gave as something you would have followed *from* it, and stop.
- `--no-<source>` drops one source from the run — `--no-confluence`, `--no-figma`,
  and whatever else this project declares. Nothing is fetched from it and nothing
  is inferred in its place.
- A name no source answers to, or the tracker itself (`--no-jira`) → say so and
  stop. Write nothing on a bad invocation.

## The folder name

Derive `<KEY>` from the ticket URL, per the table in the `jira` skill. No key in
the URL → slug of the last path segment.

## Routing

The sources are **not a fixed list — read them from the project.** Every skill
under `agentic/skills/` whose `SKILL.md` carries a `## Source` section is one,
and that section is its declaration:

| Field | What you do with it |
| --- | --- |
| `role` | which MCP role it needs — `AGENTS.md` says which server fills that role |
| `matches` | URL fragments; a link containing one is routed to this skill |
| `writes` | the file under `sources/` it snapshots into |
| `links` | `follow` — route what it hands back; `stop` — the chain ends there |

Out of the box that is `jira` (tracker), `confluence` (docs) and `figma`
(design), and a project can add more with `agentic-flow source add`. A skill with
no `## Source` section is not a source.

A link that matches nothing is not a source either. Name it under `Open
questions` and move on. Never guess a hostname, never search for a page by title.

## The walk

1. **Read the declarations** — that is your routing table for this run.
2. **Ticket** — the source whose `role` is `tracker`. It writes its file and
   hands back the links it found.
3. **Its links** — route each one by `matches`. Excluded by a flag → skip it,
   note the flag. Already visited → skip it.
4. **One more hop** — a source declaring `links: follow` hands back links of its
   own; route those the same way. A source declaring `links: stop` ends the
   chain.
5. **Stop there.** Two hops from the ticket is as deep as this goes, and no URL
   is read twice.

Several links of one kind → the source skill writes a section per page in its one
file, and each gets its own row in `Sources`.

## When a source does not come back

Only the ticket is fatal. Anything else degrades:

- flag → `| Design | skipped (--no-figma) | — |`
- no server for the role → `| Design | unavailable — no design server | — |`
- link simply absent → `| Design | no link in the ticket or the analytics doc | — |`

The run continues, `requirements.md` gets written, and everything that source
would have answered goes into `Missing in sources`. A missing source is never
filled in from the others.

## No analytics document

- **`--no-confluence` was given.** The user already decided. Copy the ticket
  description verbatim into `sources/analytics.md`, cite it as `ticket`, and say
  so in `Sources`:
  `| Analytics | skipped by --no-confluence — ticket description used | yy-mm-dd hh:mm |`

- **No flag, and the ticket carries no analytics link.** Do not search for one and
  do not quietly promote the description. **Stop without writing
  `requirements.md`** and return exactly one question:

  > The ticket has no link to an analytics document. Should the ticket description
  > be treated as the analytics documentation?

  The main session puts it to the user and runs you again with the answer.

  - **Yes** → copy the description verbatim into `sources/analytics.md` under
    `# Analytics — the ticket description`, with the line
    `_the user decided to treat the ticket as the analytics document · yy-mm-dd hh:mm_`.
    `Sources` records
    `| Analytics | the ticket description — by the user's decision | yy-mm-dd hh:mm |`
  - **No** → write `requirements.md` with no analytics source. The first
    `Open question` is "an analytics document is needed".

A link that exists but will not load is not this case — that is "When a source
does not come back".

## Every file carries the ticket URL

Every file under `agentic/tasks/<KEY>/` — `requirements.md` and each
`sources/*.md` — starts with:

```markdown
**Ticket:** https://company.atlassian.net/browse/PROJ-123
```

Files get opened one at a time, from a PR or a `git blame` months later. Each one
must say where it came from without reading its neighbours.

## Hard rules

- **Follow links, never build them.** Only URLs that appear in the ticket or in a
  document you already read.
- **Every requirement cites a source.** No citation → it is not a requirement, it
  is an `Open question`.
- **Absent states are absent.** Error, empty, loading, offline, no-permission — if
  the design does not show it, it goes in `Missing in sources`. Never invent one
  because it seems obvious.
- **Contradictions are not resolved by you.** Analytics says one thing, design
  another → both go in `Open questions`, named.
- **`Sources` accounts for all three.** Every source is either fetched, skipped by
  a flag, unavailable, or absent — and the table says which.
- **No implementation.** No file names, no function names, no schema, no library
  choices. That is the assignee's job.
- **Empty `Open questions` is a smell.** On a real ticket it is almost never
  empty. If yours is, you are filling gaps yourself — go back and find them.

Write the files in the language set by the document language rule in `AGENTS.md`.

## Work assignments

List the agents in `agentic/agents/`. For each piece of work, name who should do
it and what specifically. An assignee may be an existing agent, or a proposal to
create one — mark those with `?`. Do not force the work into a fixed set of
layers.

## Template

```markdown
# <KEY> — <title>

**Ticket:** <url>
_specified yy-mm-dd hh:mm_

## Goal

One paragraph. Describe the outcome the way the people using the product would,
not the way the system does.

## Sources

| What | Link | Fetched |
| --- | --- | --- |
| Ticket | <url> | yy-mm-dd hh:mm |
| Analytics | <url> | yy-mm-dd hh:mm |
| Design | skipped (--no-figma) | — |

One row per declared source, whether it was read or not.

## Requirements

- **R1** … — `analytics §2.1`
- **R2** … — `design: Checkout / Empty`

## Out of scope

- …

## Work assignments

| Assignee | What to do | Why | Confidence |
| --- | --- | --- | --- |
| `backend` | … | R1, R3 | high |

## Open questions

- **Q1** → analyst: …
- **Q2** → designer: …

## Missing in sources

States and flows present in neither the analytics doc nor the design, plus
everything a skipped or unavailable source would have answered.
```
