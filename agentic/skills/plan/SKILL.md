---
name: plan
description: Split an accepted requirements.md into subtasks and write them to agentic/tasks/<KEY>/subtasks.md, each subtask naming the requirements it covers. Use after a human has accepted the specification of a ticket and wants it broken into units of work.
---

# Split requirements.md into subtasks

You read one file, `agentic/tasks/<KEY>/requirements.md`. You write one file,
`agentic/tasks/<KEY>/subtasks.md`. You do not write code.

Run inside the `planner` subagent. It has no `Edit` and no `Bash`, so it cannot
change code.

Each subtask says what will be true when the work is done. It does not say how to
build it.

## Step 1. Check that you may start

Someone calling this skill means a human has read `requirements.md` and accepted
it. Check two things first.

1. Is there a `requirements.md` for this ticket?
   - No → stop. Say the specification has to be written first, with the `spec`
     skill. Write nothing.
2. Does `requirements.md` still have unanswered items under `Open questions`?
   - Yes → show them to the user and ask whether to split the work anyway. Wait
     for the answer. Do not answer the questions yourself and do not decide for
     the user.

Write this line into the header of your output:

```
_decomposed from requirements.md accepted by the user · 2026-09-13 14:20_
```

## Step 2. Read the specification

Read all of `requirements.md`: the requirements, `Out of scope`,
`Work assignments`, `Open questions` and `Missing in sources`.

Open a file in `sources/` only if a requirement makes no sense without it.

## Step 3. Group the requirements into subtasks

A subtask is a piece of work that can be finished and checked on its own.

Give every subtask a size in hours, for a middle developer. Use this table to
decide what to do with the number.

| Your estimate | What to do |
| --- | --- |
| 2 to 8 hours | keep it as one subtask |
| more than 8 hours | split it into smaller subtasks |
| less than 2 hours, and another subtask belongs with it | merge the two |
| less than 2 hours, and it is the only subtask of the ticket | keep it, any size |
| more than 8 hours and genuinely cannot be split | keep it, mark it, see below |

Split by result, not by activity. "Cart page shows an empty state" is a result.
"Write the code" and "write the tests" are activities, so that is not a split.

If a subtask cannot be split under 8 hours, for example one database migration
that has to happen at once:

1. keep it as one subtask;
2. write `Size: >8h (indivisible)`;
3. give the reason in one line;
4. list it under `Gaps`.

Never make a number up to fit the range. Do not invent a boundary that is not
there, and do not quietly write a 40-hour subtask.

You are estimating from a document, so your numbers can be wrong. Say how sure
you are on the `Uncertainty` line. `high` means the number is a guess and the
subtask probably splits further.

## Step 4. Number the priorities

Every subtask gets a number. A smaller number means start it earlier.

Work the number out from the dependencies. Do not use importance, and do not use
size.

- A subtask that depends on nothing gets `1`.
- Any other subtask gets `the largest priority in its "Depends on" list, plus 1`.

Worked example:

- S1 depends on nothing → `1`
- S3 depends on nothing → `1`
- S2 depends on S1 → `1 + 1` = `2`
- S4 depends on S2 and S3 → `max(2, 1) + 1` = `3`

Subtasks with the same number can be started at the same time.

Check all four before you write the file:

- every subtask in a `Depends on` list has a smaller number than the subtask
  listing it;
- the numbers start at 1;
- no number between 1 and the largest is missing;
- no loop. If S1 depends on S2 and S2 depends on S1, the split is wrong. Fix the
  split. If you cannot, write it under `Gaps`.

`Blocked by` does not change the number. A subtask waiting on an open question
keeps its priority and stays marked as blocked.

## Step 5. Write subtasks.md

Use the template at the end of this file.

Start the file with the full ticket URL, copied from `requirements.md`:

```markdown
**Ticket:** https://company.atlassian.net/browse/PROJ-123
```

Write the file in the language set by the document language rule in `AGENTS.md`.

### Rules for the content

**Every subtask names requirement ids.** Write them on the `Covers` line, for
example `Covers: R1, R2`. If a subtask covers no requirement, it is not a
subtask. Move it to `Gaps`.

**Every requirement ends up in a subtask.** Check this with the `Coverage` table.
If a requirement fits nowhere, write it under `Gaps`. Do not invent a subtask to
hold it.

**Say what is blocked, do not unblock it.** If a subtask depends on an open
question, write that question id on the `Blocked by` line. Do not answer it.

**No implementation detail.** No file paths, no function names, no database
tables. Write what is true when the work is done.

**`Out of scope` stays out.** Nothing listed there becomes a subtask.

**Fill `Assignee` from the `Work assignments` table** in `requirements.md`. If no
row fits, write `?` and list that subtask under `Gaps`.

## Step 6. Stop

Do not implement anything. Do not change code. Show the user the path of the file
you wrote and the `Gaps` section.

## Before you finish

Check each line. All of them must be true.

- [ ] The file starts with the full ticket URL.
- [ ] Every subtask has `Priority`, `Covers`, `Assignee`, `Size`, `Done when`.
- [ ] Every number in `Depends on` belongs to a subtask with a smaller priority.
- [ ] Every requirement id from `requirements.md` appears in `Coverage`.
- [ ] No subtask mentions a file name, a function name or a library.
- [ ] Anything you could not place is written under `Gaps`.

## Template

```markdown
# <KEY> — subtasks

**Ticket:** <url>
_decomposed from requirements.md accepted by the user · 2026-09-13 14:20_
_4 subtasks · ~18h total_

## Priority groups

Subtasks on one row can be started at the same time.

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
- **Done when:** what someone can observe once this is finished.
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

Write here: requirements that fit no subtask, subtasks with `?` as the assignee,
subtasks larger than 8 hours that could not be split, and anything else a human
has to decide before this plan can be used.
```
