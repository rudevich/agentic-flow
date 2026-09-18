# Tasks

One directory per ticket, everything committed.

```
tasks/<KEY>/
├── requirements.md   # written by the specificator, accepted by a human
├── subtasks.md       # written by the planner, after that acceptance
├── design/           # written by /design, one file per Figma link
└── sources/          # one file per page, written by the readers
    ├── ticket/PROJ-123.md
    ├── analytics/checkout-flow.md
    ├── analytics/pricing.md          # a page too big for one read: an index
    └── analytics/pricing.part-1.md   # … and its parts
```

`<KEY>` comes from the ticket URL. `…/browse/PROJ-123` gives `PROJ-123`.

## Flow

```
/spec https://company.atlassian.net/browse/PROJ-123
    → requirements.md + sources/, then stops

    a human reads it and takes Open questions back to the analyst and designer

/plan PROJ-123
    → subtasks.md, each subtask traceable to a requirement
```

`/spec` takes a **ticket** URL. It follows only the links the ticket actually
carries. There is one source skill per kind of link: `jira`, `confluence`,
`figma`. That is what lets a branch be turned off:

```
/spec <ticket-url> --no-figma        # do not open the design
/spec <ticket-url> --no-confluence   # the ticket description is the analytics
```

`--no-<source>` works for every source the project declares, not just these two.
See `agentic/skills/README.md` for adding one.

Calling `/plan` is the acceptance signal. It means a person read the
specification. Unanswered `Open questions` do not block it, but the planner shows
them and asks before decomposing.

## One reader per link

Every page is fetched by its own `reader` subagent, one per link, and they run at
the same time. A reader returns about twenty lines: where it put the snapshot,
the facts it found with their anchors, and the links on the page. The page itself
never leaves that subagent.

That is what makes a ticket with four Confluence pages and two designs possible
at all. Without it the raw responses alone would fill the context before the
first requirement was written.

Five links per source per round is the limit. Anything past it is listed in
`Sources` as `not read (over the limit)`, and named under `Missing in sources`.
A link farm then produces a short specification instead of an exhausted run.

## A page too big for one reader

`agentic/settings.json` sets `MAX_MCP_OUTPUT_TOKENS`. An MCP answer above it is
saved to a file, and the reader gets the file's path instead of the page. How the
answer arrives tells the reader how big the page is, so no second request is
needed.

| The answer | Strategy |
| --- | --- |
| the page itself | `inline` |
| a saved file that fits one part | `whole file`: the reader reads it itself |
| a saved file of two parts or more | `parts`: one `part-reader` per part |

A part is about 12 KB or 150 lines, and at most eight parts are read. Each part
becomes its own `<slug>.part-N.md`, and `<slug>.md` becomes an index of them.
Lines past the eighth part are listed as `partial` in `Sources` and named under
`Missing in sources`.

## Designs have their own command

The `figma` skill ships with `fetch | no` in its `## Source` table, so `/spec`
opens no design. It lists every Figma link it finds under `## Design` in
`requirements.md`, with the page it was found in, and `Sources` says
`links only`.

```
/design PROJ-123
    → design/checkout.md, one file per link
```

`/design` reads those links whenever you want them, before or after the
specification is accepted. How a design is read is still provisional.

## Running /spec again

`/spec` on a ticket that already has a specification reads everything from
scratch. It first deletes `requirements.md`, `subtasks.md` and `sources/`, so an
answer that arrived in Confluence in the meantime simply stops coming back as a
question. Nothing is merged, and `design/` is left alone.

Commit the task folder before re-running, and `git diff` then shows what the
answers changed. Re-run `/plan` afterwards: its `subtasks.md` went with the rest.

## Why snapshot the sources

The analytics doc and the design keep moving. Without a copy taken at
specification time you cannot tell later whether the code drifted or the spec
did. Each snapshot carries its URL and the time it was fetched.

A source that was never read leaves a row rather than a silence. The `Sources`
table in `requirements.md` gives the reason. It is one of
`skipped (--no-figma)`, `unavailable — no design server`,
`not read (over the limit)`, or "no link in the ticket". A page read only in part says
`partial` and names the lines nobody read. What that source would have answered is listed under `Missing in sources`. Requirements are never filled
in from the sources that did load.

Every file also carries the full ticket URL near the top, so a file opened on its
own still says where it came from.

## Reading requirements.md

- Every requirement cites a source. One that does not is a bug in the spec.
- `Open questions` is the point of the exercise. That is what you take back to
  the analyst and the designer.
- `Missing in sources` lists states nobody has designed yet. On a real ticket an
  empty list usually means the agent filled the gaps itself.
- Does `Sources` say "by the user's decision" or `skipped by --no-confluence`?
  Then the requirements rest on the ticket description alone. The copy of it is
  in `sources/analytics.md`.

## Reading subtasks.md

- `Priority` is a start order, not an importance ranking. Lower goes first. The
  same number means those subtasks can be picked up in parallel. `Priority
  groups` at the top is the same information, read as rows.
- Each subtask is sized **2–8 hours for a middle developer**. Anything bigger is
  flagged `>8h (indivisible)` and listed under `Gaps` for you to decide on. A
  ticket that is a single piece of work gets one subtask, however small.
- `Coverage` must account for every requirement. A missing one means the
  decomposition lost something.
- `Gaps` is where the planner puts what it could not place. Read it first.
- Subtasks say what is true when they are done, not which files to touch.
- The sizes are judgements made from a specification, not measurements. Treat a
  `high` uncertainty next to an 8h subtask as "this probably splits further".
