# Skills

One directory per skill, each with a `SKILL.md`:

```
skills/
└── my-skill/
    ├── SKILL.md
    └── references/…      (optional supporting files)
```

`SKILL.md` opens with YAML frontmatter:

```markdown
---
name: my-skill
description: What the skill does and when to use it. This text is how an agent
  decides whether to load it.
---

# My skill

Instructions here.
```

`description` must name the triggers ("when the user asks to …"), not just the
topic.

## Skills that are sources

A skill becomes a **source** for the `spec` pipeline by carrying a `## Source`
section. `spec` routes by it, and `agentic-flow` wires up the MCP server and the
roles table from it:

```markdown
## Source

| Field | Value |
| --- | --- |
| role | docs |
| matches | notion.so, notion.site |
| writes | sources/analytics.md |
| server | notion |
| auth | token |
| links | follow |
```

| Field | What to put in it |
| --- | --- |
| `role` | any name you like. The `MCP roles` table in `AGENTS.md` grows to fit. |
| `matches` | URL fragments. No regular expressions, case-insensitive. |
| `writes` | the file under `sources/` this skill fills in. |
| `server` | MCP server names that can fill the role. A list, so one `atlassian` server can serve two skills. |
| `auth` | `token` if its server needs one, `none` if it connects some other way. Say how in the skill itself. |
| `links` | `follow` if what it reads leads on to other sources, `stop` if the chain ends there. |

Nothing here handles the token itself. The `auth` field only shapes the
instructions printed when the role is empty.

```bash
agentic-flow source add notion --role docs --matches notion.so
```

writes the skill from a template with these sections ready to fill in. Written by
hand instead? `agentic-flow config` picks it up.

## What a source skill must contain

Copy the shape of `jira/SKILL.md`. These sections, in this order:

1. `## Which URLs are yours`
2. `## Which tool to use`
3. `## What to copy`
4. `## What to write` — the output template, plus the rule that the timestamp is
   the current one and no angle brackets may survive
5. `## What to report back` — the `written:` and `links:` answer `spec` expects
6. `## If you cannot read …` — what to answer when the page will not load
7. `## Source` — the table above

`spec` depends on sections 5 and 7. The rest is what keeps a weaker model from
inventing content it never read.
