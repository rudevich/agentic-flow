# Agents

One Markdown file per subagent: `agents/my-agent.md`.

```markdown
---
name: my-agent
description: When this agent should be used.
tools: Read, Grep, Glob, Bash
---

System prompt for the agent.
```

`tools` is optional. Omit the line to inherit every tool. Name the tools to take
capabilities away, which is how `specificator` and `planner` are kept from
touching code.

Narrow jobs only. Broad agents re-derive context the main session already has.
