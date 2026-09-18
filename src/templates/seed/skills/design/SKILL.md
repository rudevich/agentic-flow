---
name: design
description: Read the Figma links a specification lists into agentic/tasks/<KEY>/design/, one file per design. Use when asked to read, or to refresh, the designs of a ticket that already has a requirements.md.
---

# Read the designs a specification points at

You are given a ticket key. The designs it links are read into its task folder,
one file each. You write no code, and you never change `requirements.md`.

**This skill is provisional.** A design is read the way the `figma` skill has
always read one. How that should work is not settled yet, and this is the place
where it will be worked out.

## Step 1. Read the command

The command looks like this:

```
/design PROJ-123
```

A ticket URL works too: the key is the part that looks like `PROJ-123`.

## Step 2. Check that you may start

1. Is there an `agentic/tasks/<KEY>/requirements.md`?
   - No → stop. Say the specification comes first, and that the `spec` skill
     writes it. Write nothing.
2. Does that file have a `## Design` section naming at least one link?
   - No, or it says `none` → stop. Say the ticket links no design. Write nothing.

The `spec` skill puts the links there. It never opens them, which is why they are
still waiting here.

## Step 3. Send the designer

Send one `designer` agent with the Agent tool. Give it the task folder and every
link from `## Design`, each with the page it was found in:

```
Read the designs of agentic/tasks/PROJ-123/ into its design/ folder.
- https://www.figma.com/design/abc123/Checkout — ticket
- https://www.figma.com/file/xyz789/Cart — analytics: checkout-flow
```

One designer for the whole list. The designs stay inside it: what comes back is
the list of files it wrote, and the links it could not open.

## Step 4. Report what it wrote

Copy the shape below into your answer. It is an answer, not a file.

```markdown
# PROJ-123 — designs read 2026-09-13 14:20

| Design | File |
| --- | --- |
| Checkout | agentic/tasks/PROJ-123/design/checkout.md |

Not read:

- https://www.figma.com/design/zzz111/Admin — no MCP server for the design role
```

Use the current date and time. Do not copy the example.

Replace every `<…>` with a real value. No angle brackets may remain in what you
write.

### Rules for the content

- **N1 — everything written is under `agentic/tasks/<KEY>/design/`.** One file per
  design, named after the design.
- **N2 — nothing else is touched.** `requirements.md`, `subtasks.md` and
  `sources/` are read-only here.
- **N3 — a design nobody could open is named, with the reason.** Never describe
  screens from the analytics document instead.
- **N4 — no requirements, no subtasks.** A design read later does not rewrite a
  specification a person already accepted. Say what changed and let them decide.

## Step 5. Stop

Show the user the answer from step 4. Do not plan the work, and do not touch
code.

## Before you finish

- [ ] `requirements.md` existed before you started (step 2).
- [ ] Every link in `## Design` went to the designer (step 3).
- [ ] Everything written is inside `agentic/tasks/<KEY>/design/` (N1).
- [ ] `requirements.md`, `subtasks.md` and `sources/` are untouched (N2).
- [ ] Every link nobody could open is named with its reason (N3).
- [ ] You wrote no requirement and no subtask (N4).
