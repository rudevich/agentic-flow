---
name: spec
description: Turn a ticket URL into a reviewable requirements.md. Read the ticket, follow the Confluence and Figma links it contains, and write requirements that each say which source they came from. Use when given a ticket URL to specify before implementation, or when asked what a ticket requires.
---

# Write requirements.md from a ticket URL

You are given the URL of one ticket. Readers fetch it and everything it links to.
You write one file: `requirements.md`. You do not write code.

You never open a page yourself. You send one `reader` agent per link, and each
reader hands you back a few lines. The pages stay in the readers.

That is the whole point of this design. A ticket with four links would otherwise
pour four pages into your context and leave no room to think.

Steps 1 to 5 run in the main session. Step 6 onwards runs in the `specificator`
subagent, which has no `Edit` and no `Bash`, so it cannot change code.

## What you create

```
agentic/tasks/<KEY>/
├── requirements.md     written by the specificator
├── subtasks.md         NOT yours. The plan skill writes it later.
├── design/             NOT yours. The design skill writes it later.
└── sources/
    ├── ticket/         one file per ticket, written by a reader
    └── analytics/      one file per page, written by a reader
```

Write nothing outside `agentic/tasks/<KEY>/`.

## How to send a reader

One link, one reader. Use the Agent tool with the `reader` agent, and tell it
three things: the URL, the name of the skill that reads it, and the task folder.

```
Read https://co.atlassian.net/wiki/spaces/PROD/pages/12345
with the confluence skill, for agentic/tasks/PROJ-123/
```

Send every reader of one round in a single batch, so they run at the same time.

Each reader answers in the same shape:

```
source: confluence
url: https://co.atlassian.net/wiki/spaces/PROD/pages/12345
strategy: inline
written: agentic/tasks/PROJ-123/sources/analytics/checkout-flow.md
facts:
- §2.1 a cart keeps its items for 30 days
links:
- https://www.figma.com/design/abc123/Checkout -> figma
```

or, when it could not read its page:

```
source: confluence
url: https://co.atlassian.net/wiki/spaces/PROD/pages/12345
written: none
reason: no MCP server for the docs role
```

or, when the page was too big for one read and some of it stayed unread:

```
source: confluence
url: https://co.atlassian.net/wiki/spaces/PROD/pages/12345
strategy: parts
written: agentic/tasks/PROJ-123/sources/analytics/checkout-flow.md
parts: 8
unread: lines 1201–1350
facts:
- §2.1 a cart keeps its items for 30 days
links: none
```

Keep every digest. `links` feeds step 5, `written` and `unread` feed step 6, and
`facts` is what the requirements are written from.

**An answer with no `written:` line is a failed read.** Treat it as
`written: none` with the reason `the reader did not finish`. That covers an
error, an answer cut off halfway, and raw page text. Take no facts from it.

Never ask a reader for the page itself. If you find yourself wanting the whole
text, you want one exact sentence: open that one snapshot file with `Read`.

## Step 1. Read the command

The command looks like this:

```
/spec <ticket-url> [--no-<source>…]
```

Check three things, in this order:

1. Is the argument a ticket URL? A ticket URL contains `/browse/` or
   `selectedIssue=`.
   - If it is a Confluence or Figma URL: stop. Reply that a specification starts
     from a ticket, and that you would have opened their link from inside the
     ticket. Write nothing.
2. Is every flag `--no-<name>` where `<name>` is a source this project has?
   - If a flag names something else, for example `--no-banana`: stop. Say the
     flag is unknown. Write nothing.
3. Does any flag name the tracker source, for example `--no-jira`?
   - If yes: stop. Say the ticket cannot be skipped. Write nothing.

If all three checks pass, continue to step 2.

`--no-figma` means: do not open the design. Do not replace it with a guess.
`--no-confluence` means: do not open the analytics page. Same rule.

## Step 2. Work out the folder name

`<KEY>` comes from the ticket URL.

| URL | `<KEY>` |
| --- | --- |
| `https://co.atlassian.net/browse/PROJ-123` | `PROJ-123` |
| `https://co.atlassian.net/jira?selectedIssue=PROJ-123` | `PROJ-123` |
| no key anywhere in the URL | the last path segment, as a slug |

### Start the task folder empty

A ticket that was specified before is read again from scratch. Delete these
three, and nothing else, before step 4:

```
agentic/tasks/<KEY>/requirements.md
agentic/tasks/<KEY>/subtasks.md
agentic/tasks/<KEY>/sources/
```

Nothing is merged. The pages are read again, and the questions are asked again:
whatever was answered in the meantime simply stops coming back.

Leave `agentic/tasks/<KEY>/design/` where it is. It belongs to the `design`
skill, and step 9 says it may be out of date.

Build every path from `<KEY>`, and from nothing else. Delete no other path.

## Step 3. Build the routing table

Do not assume the project has three sources. Read them.

1. List the directories under `agentic/skills/`.
2. Open each `SKILL.md`.
3. Keep the ones that contain a `## Source` section. Those are your sources.
4. A skill with no `## Source` section is not a source. Ignore it here.

Each `## Source` section is a small table. Use it like this:

| Field | What you do with it |
| --- | --- |
| `role` | which MCP server reads it. `AGENTS.md` says which server fills the role. |
| `matches` | text fragments. A URL containing one of them goes to this skill. |
| `writes` | the directory under `sources/` where its snapshots go, one file per page. |
| `links` | `follow` means route the links it finds. `stop` means do not. |
| `fetch` | `yes` means send a reader to its links. `no` means only list them, see step 5. |

A project starts with three sources: `jira` (role `tracker`), `confluence`
(role `docs`), `figma` (role `design`, `fetch: no`). More can be added later. Your routing
table is whatever you found in step 3, not this list.

## Step 4. Read the ticket

Find the source whose `role` is `tracker`. That is your entry point.

Send one reader: the ticket URL, that skill's name, the task folder. It writes
the snapshot and answers with the ticket's facts and the links in it.

If the reader answers `written: none`, or with no `written:` line at all: stop. Say what it reported. Write no
`requirements.md`. You cannot specify a ticket nobody could read, and you must
never guess what a ticket says from its key.

## Step 5. Follow the links

Take the links the ticket gave you. For each one, in order:

1. Does the URL contain one of the `matches` fragments of some source?
   - No → do not open it. Add it to `Open questions` as an unrecognised link.
2. Was that source excluded by a `--no-` flag?
   - Yes → skip it. Remember the flag for the `Sources` table.
3. Have you already read or listed this exact URL?
   - Yes → skip it.
4. Does that source say `fetch: no`?
   - Yes → do not open it. Remember the link, with the page it was found in. It
     goes into `requirements.md`, see step 8. The five-link limit does not apply
     to a link nobody opens.
5. Would this be the sixth link for that source in this round?
   - Yes → skip it. Remember it for the `Sources` table and for
     `Missing in sources`.
6. Otherwise → it gets a reader.

Send every reader that survived those checks in one batch. Then take the links
those readers gave you and repeat the same six checks once, as a second batch.

Then stop following links. Two rounds away from the ticket is the limit:
ticket → analytics → design. A source whose declaration says `links: stop` gives
you nothing to follow.

**Five links per source per round, and no more.** A ticket that links twelve
pages gets five of them read and seven listed as unread. A short specification
that says what it did not read is worth more than a run that dies halfway.

Never invent a URL. Only send a reader to a link that was written in a page that
had already been read. Never search for a page by its title.

Two links of the same kind, for example two Confluence pages? Two readers, two
files, two rows in `Sources`.

### Hand over when the reading is done

You now hold one digest per page and no pages. Send them all to the
`specificator` agent, with the task folder, the flags that were used and the
links nobody opened:

```
Write agentic/tasks/PROJ-123/requirements.md from these digests.
Flags: none
Design links:
- https://www.figma.com/design/abc123/Checkout?node-id=12-34 — ticket
- https://www.figma.com/file/xyz789/Cart — analytics: checkout-flow
<every digest, word for word>
```

Write `Design links: none` when the ticket linked no design. Never open one of
them yourself, and never describe what it shows.

The specificator follows steps 6 to 9 and writes the file. Everything below this
line is written for it.

## Step 6. Account for every source

The `Sources` table in `requirements.md` has one row per source in your routing
table. Every source is in exactly one of these states. Write the matching row:

| State | Row to write |
| --- | --- |
| read | `\| Design \| <url> \| <date and time> \|` |
| excluded by a flag | `\| Design \| skipped (--no-figma) \| — \|` |
| the source says `fetch: no` | `\| Design \| links only — see Design \| — \|` |
| the reader answered `written: none` | `\| Design \| unavailable — <reason> \| — \|` |
| the digest has `unread:` with lines, not `none` | `\| Analytics \| <url> — partial, lines 1201–1350 not read \| <date and time> \|` |
| over the five-link limit | `\| Analytics \| 7 more not read (over the limit) \| — \|` |
| no link to it anywhere | `\| Design \| no link in the ticket or the analytics doc \| — \|` |

One row per page that was read, not one row per source: two Confluence pages are
two rows.

A partial page also gets a line under `Missing in sources`. Nobody knows what its
unread lines say.

A `links only` source gets one too. Nobody opened its pages, so what they show is
unknown. Write no requirement from a listed link.

Only the ticket is fatal. If any other source is missing, keep going and write
`requirements.md`. Everything that source would have told you goes under
`Missing in sources`.

Never fill a missing source in from another one. If the design was not read, you
do not know what the screens look like. Write that down instead of describing
them.

## Step 7. Handle a missing analytics document

This step has two cases. Pick one.

**Case A: the command contained `--no-confluence`.**

The user has already decided. Do this without asking:

1. Copy the ticket description, word for word, into `sources/analytics.md`.
2. Cite those requirements as `ticket`.
3. Write this row in `Sources`:
   `| Analytics | skipped by --no-confluence — ticket description used | <date and time> |`

**Case B: there was no flag, and the ticket has no link to an analytics page.**

Do not search for one. Do not decide by yourself that the description is the
analytics document.

Stop. Do not write `requirements.md`. Return exactly this question and nothing
else:

> The ticket has no link to an analytics document. Should the ticket description
> be treated as the analytics documentation?

The main session asks the user and runs you again with the answer.

- Answer yes → copy the description word for word into `sources/analytics.md`.
  Start that file like this:

  ```markdown
  # Analytics — the ticket description

  **Ticket:** https://co.atlassian.net/browse/PROJ-123
  _the user decided to treat the ticket as the analytics document · 2026-09-13 14:20_
  ```

  Then write this row in `Sources`:
  `| Analytics | the ticket description — by the user's decision | <date and time> |`
- Answer no → write `requirements.md` with no analytics source. Make
  "an analytics document is needed" your first `Open question`.

A link that exists but fails to load is **not** this case. That is step 6.

## Step 8. Write requirements.md

Write one file: `agentic/tasks/<KEY>/requirements.md`. Copy the shape below.

```markdown
# <KEY> — <ticket title>

**Ticket:** <url>
_specified 2026-09-13 14:20_

## Goal

One paragraph. Describe the result the way a person using the product would
describe it, not the way the system works.

## Sources

| What | Link | Fetched |
| --- | --- | --- |
| Ticket | <url> | 2026-09-13 14:20 |
| Analytics | <url> | 2026-09-13 14:20 |
| Design | skipped (--no-figma) | — |

## Requirements

- **R1** … — `analytics §2.1`
- **R2** … — `ticket: description`

## Design

| Link | Found in |
| --- | --- |
| https://www.figma.com/design/abc123/Checkout | ticket |

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

States and flows that neither the analytics document nor the design describes.
Add here everything a skipped or unavailable source would have answered.
```

Use the current date and time. Do not copy the example.

Replace every `<…>` with a real value. No angle brackets may remain in what you
write.

`requirements.md` and every file in `sources/` start with the full ticket URL:

```markdown
**Ticket:** https://co.atlassian.net/browse/PROJ-123
```

People open these files one at a time, months later. Each file has to say where
it came from on its own.

Write the file in the language set by the document language rule in `AGENTS.md`.

### Rules for the content

- **N1 — every requirement names its source.** Write the source in backticks
  after the text: `` — `analytics §2.1` ``. If you cannot name a source, it is
  not a requirement. Move it to `Open questions`.
- **N2 — write down only states you saw.** Error, empty, loading, offline, no
  permission: if the design does not show a state, do not write a requirement for
  it. Put it under `Missing in sources` instead. Example: the design shows a
  filled cart but no empty cart, so "empty cart" goes under `Missing in sources`.
- **N3 — do not settle disagreements.** If the analytics page says 30 days and
  the design shows 14 days, do not choose. Write both numbers into one
  `Open question` and name both sources.
- **N4 — do not design the solution.** No file names, no function names, no
  database tables, no library choices. Write what must be true, not how to build
  it.
- **N5 — `Open questions` is not empty.** A real ticket almost always leaves
  something unanswered. If your list is empty, you probably answered something
  yourself. Go back through the requirements and find the guesses.
- **N6 — a design link is not a source.** Nobody opened what is under `## Design`.
  Write `none` there when the ticket linked no design, cite no link in a
  requirement, and leave the reading to `/design <KEY>`.

### Work assignments

1. List the files in `agentic/agents/`. Those are the agents that exist.
2. For each piece of work, write one row: who does it and what exactly.
3. If no existing agent fits, write the name you would give a new one and put `?`
   in the row.

Do not force the work into a fixed set of layers such as backend and frontend.
Use what the ticket actually needs.

## Step 9. Stop

Do not plan the implementation. Do not write `subtasks.md`. Do not touch code.

Show the user:

1. the path of the file you wrote;
2. the `Open questions` section, word for word;
3. the `Missing in sources` section, word for word.

If `design/` already holds designs, say they were read before this run and may be
out of date. `/design <KEY>` reads them again.

A human reads the specification and accepts it. Breaking it into subtasks is the
`plan` skill, and it runs later.

## Before you finish

Check each line. All of them must be true.

- [ ] Everything you wrote is inside `agentic/tasks/<KEY>/` (step 8).
- [ ] `requirements.md` and every file in `sources/` start with the ticket URL
      (step 8).
- [ ] No angle brackets are left anywhere in what you wrote (step 8).
- [ ] Every date you wrote is the real date, not `2026-09-13 14:20` (step 8).
- [ ] Every requirement has a source in backticks after it (N1).
- [ ] `Sources` has one row per source in your routing table (step 6).
- [ ] Every page with unread lines is marked partial in `Sources` and named under
      `Missing in sources` (step 6).
- [ ] Every URL you opened came from a page you had already read (step 5).
- [ ] A ticket specified before was emptied before the reading started (step 2).
- [ ] Every design link found is under `## Design`, and none of them was opened
      (N6).
- [ ] `requirements.md` contains no file names, function names or library names
      (N4).
- [ ] `Open questions` is not empty (N5).
- [ ] You wrote no code and changed no existing file outside the task folder.
