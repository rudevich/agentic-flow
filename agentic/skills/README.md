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
description: What the skill does and when to use it — this text is how an agent
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

- `role` — any name you like; the `MCP roles` table in `AGENTS.md` grows to fit.
- `matches` — URL fragments, no regular expressions, case-insensitive.
- `server` — MCP server names that can fill the role; a list, so one `atlassian`
  server can serve two skills.
- `auth` — `token` if its server needs one, `none` if it connects some other way
  (say how in the skill). Nothing here handles the token itself; the field only
  shapes the instructions printed when the role is empty.
- `links` — `follow` if what it reads leads on to other sources, `stop` if the
  chain ends there.

```bash
agentic-flow source add notion --role docs --matches notion.so
```

writes the skill from a template with these sections ready to fill in. Written by
hand instead? `agentic-flow config` picks it up.
