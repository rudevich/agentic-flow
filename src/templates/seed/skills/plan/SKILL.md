---
name: plan
description: Decompose an accepted requirements.md into traceable subtasks and write them to agentic/tasks/<KEY>/subtasks.md. Use after a human has accepted the specification of a ticket and wants it broken into units of work.
---

# Decomposing an accepted specification

Input: `agentic/tasks/<KEY>/requirements.md`.
Output: `agentic/tasks/<KEY>/subtasks.md`.

Run this in the `planner` subagent — no `Edit`, no `Bash`, so it cannot touch
code. Decomposition only: the subtasks say what must be true when each piece is
done, not how to build it.

## The human gate

Calling this skill *is* the signal that a person read `requirements.md` and
accepted it. Two things to check before decomposing:

1. No `requirements.md` for this ticket → stop and say the specification comes
   first (`spec` skill).
2. `requirements.md` still has unanswered `Open questions` → show them and ask
   whether to decompose anyway. The human decides; do not decide for them, and do
   not answer the questions yourself.

Record the gate in the output header:
`_decomposed from requirements.md accepted by the user · yy-mm-dd hh:mm_`

## Steps

1. Read `requirements.md` in full — requirements, `Out of scope`,
   `Work assignments`, `Open questions`, `Missing in sources`. Read `sources/`
   only when a requirement is ambiguous without it.
2. Group the requirements into units that can be finished and checked on their
   own, each **2–8 hours** of work — see "Size" below.
3. Work out what must exist before what, and turn that into priorities — see
   "Priority" below.
4. Write `subtasks.md`.
5. Stop. No implementation.

## Priority

Every subtask carries a number. **Lower is higher priority**, and it comes from
the dependencies, not from importance:

- nothing it depends on → `1`;
- otherwise `max(priority of everything in Depends on) + 1`.

So everything that can be started at the same time shares a number, and a
subtask's priority is always strictly greater than that of anything it waits for.

Check yourself before writing the file:

- every `Depends on` entry has a strictly smaller priority;
- the numbers start at 1 and leave no gaps;
- no cycle. A depends on B and B on A is a decomposition error, not a priority
  puzzle — fix the split, and if you cannot, put it in `Gaps`.

Priority answers "when can this be started", not "how does this compare to its
neighbour". Two subtasks that do not touch each other can still differ: one may
sit behind a dependency the other does not have.

`Blocked by` does **not** change the number. A subtask waiting on an open
question keeps its priority and stays flagged — one unanswered question for the
analyst must not reshuffle the whole plan.

## Size

Every subtask is **2 to 8 hours of work for a middle developer**. That is the
unit: small enough to finish and review inside a day, big enough to be worth
tracking separately.

- **Over 8 hours → split it.** Split along what is *done*, never along the
  mechanics ("write the code" / "write the tests" is not a split).
- **Under 2 hours → merge it** into the neighbour it belongs with. The lower
  bound only exists to stop the plan fragmenting, so it does not apply when there
  is no neighbour: a ticket whose whole specification is one piece of work gets
  **one subtask of whatever size it is**, 30 minutes included. That is a normal
  outcome, not a gap — do not invent a second subtask to pad it, and do not split
  the one you have along the mechanics.
- **Cannot be split under 8 hours** — one indivisible migration, a single
  third-party integration with no seam — then keep it whole, say `Size: >8h
  (indivisible)`, give the reason in one line, and list it under `Gaps`. A human
  decides what to do with it.
- **Never fake the bound.** Do not invent a seam that is not there to land inside
  2–8h, and do not quietly emit a 40-hour subtask.

These are judgements, not measurements, and an estimate from a specification is
the least reliable kind. Pair every number with the `Uncertainty` line: `high`
means the number is a guess and the subtask likely hides a split.

## Hard rules

- **Every subtask cites requirement ids.** A subtask covering nothing traceable
  is not a subtask — it goes under `Gaps` for a human to resolve.
- **Every requirement is covered.** If one fits nowhere, say so under `Gaps`
  rather than inventing a subtask to absorb it.
- **Blocked is stated, not solved.** A subtask that depends on an open question
  names it in `Blocked by`.
- **No implementation detail.** No paths, no function names, no schema. "What is
  true when this is done", not "which file changes".
- **Out of scope stays out.** Nothing from `Out of scope` becomes a subtask.
- **Every subtask carries a `Priority`**, derived from its dependencies — never
  from how important or how big the work feels.
- **Every subtask carries a `Size`**, inside 2–8h unless it is the only subtask
  for the ticket, or it is flagged as indivisible.
- `Assignee` comes from the `Work assignments` table in `requirements.md`. No row
  fits → leave it `?` and list it under `Gaps`.

Every file you write starts with the full ticket URL, copied from
`requirements.md`:

```markdown
**Ticket:** https://company.atlassian.net/browse/PROJ-123
```

Write the file in the language set by the document language rule in `AGENTS.md`.

## Template

```markdown
# <KEY> — subtasks

**Ticket:** <url>
_decomposed from requirements.md accepted by the user · yy-mm-dd hh:mm_
_N subtasks · ~Xh total_

## Priority groups

Everything on one row can be started at the same time.

| Priority | Subtasks |
| --- | --- |
| 1 | S1, S3 |
| 2 | S2 |
| 3 | S4 |

## Subtasks

### S1 — <title>

- **Priority:** 1
- **Covers:** R1, R2
- **Assignee:** `backend`
- **Size:** 4h
- **Done when:** what is observably true once this is finished.
- **Depends on:** —
- **Blocked by:** —
- **Uncertainty:** low | medium | high — and why, in one line.

### S2 — <title>

- **Priority:** 2
- **Covers:** R3
- **Assignee:** `?`
- **Size:** 6h
- **Done when:** …
- **Depends on:** S1
- **Blocked by:** Q2
- **Uncertainty:** …

## Coverage

| Requirement | Subtask |
| --- | --- |
| R1 | S1 |
| R2 | S1 |
| R3 | S2 |

## Gaps

Requirements that fit no subtask, subtasks with no assignee, subtasks that could
not be split under 8 hours — anything a human has to resolve before this plan is
workable.
```
