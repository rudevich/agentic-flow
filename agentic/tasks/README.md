# Tasks

One directory per ticket, everything committed.

```
tasks/<KEY>/
├── requirements.md   # written by the specificator, accepted by a human
├── subtasks.md       # written by the planner, after that acceptance
└── sources/          # snapshots of the ticket, analytics doc, design
```

`<KEY>` comes from the ticket URL — `…/browse/PROJ-123` gives `PROJ-123`.

## Flow

```
/spec https://company.atlassian.net/browse/PROJ-123
    → requirements.md + sources/, then stops

    a human reads it and takes Open questions back to the analyst and designer

/plan PROJ-123
    → subtasks.md, each subtask traceable to a requirement
```

`/spec` takes a **ticket** URL and follows only the links the ticket actually
carries. One source skill per kind of link — `jira`, `confluence`, `figma` — so a
branch can be turned off:

```
/spec <ticket-url> --no-figma        # do not open the design
/spec <ticket-url> --no-confluence   # the ticket description is the analytics
```

`--no-<source>` works for every source the project declares, not just these two —
see `agentic/skills/README.md` for adding one.

Calling `/plan` is the acceptance signal: it means a person read the
specification. Unanswered `Open questions` do not block it, but the planner shows
them and asks before decomposing.

## Why snapshot the sources

The analytics doc and the design keep moving. Without a copy taken at
specification time you cannot tell later whether the code drifted or the spec
did. Each snapshot carries its URL and the time it was fetched.

A source that was never read leaves a row rather than a silence: the `Sources`
table in `requirements.md` says `skipped (--no-figma)`, `unavailable — no design
server` or "no link in the ticket", and what it would have answered is listed
under `Missing in sources`. Requirements are never filled in from the sources
that did load.

Every file also carries the full ticket URL near the top, so a file opened on its
own still says where it came from.

## Reading requirements.md

- Every requirement cites a source. One that does not is a bug in the spec.
- `Open questions` is the point of the exercise — that is what you take back to
  the analyst and the designer.
- `Missing in sources` lists states nobody has designed yet. Empty on a real
  ticket usually means the agent filled the gaps itself.
- `Sources` says "by the user's decision" or `skipped by --no-confluence`? Then
  the requirements rest on the ticket description alone — the copy of it is in
  `sources/analytics.md`.

## Reading subtasks.md

- `Priority` is a start order, not an importance ranking: lower goes first, and
  the same number means those subtasks can be picked up in parallel. `Priority
  groups` at the top is the same information, read as rows.
- Each subtask is sized **2–8 hours for a middle developer**. Anything bigger is
  flagged `>8h (indivisible)` and listed under `Gaps` for you to decide on. A
  ticket that is a single piece of work gets one subtask, however small.
- `Coverage` must account for every requirement. A missing one means the
  decomposition lost something.
- `Gaps` is where the planner puts what it could not place — read it first.
- Subtasks say what is true when they are done, not which files to touch.
- The sizes are judgements made from a specification, not measurements. Treat a
  `high` uncertainty next to a 8h subtask as "this probably splits further".
