# Agents

One Markdown file per subagent: `agents/my-agent.md`.

```markdown
---
name: my-agent
description: When this agent should be used.
tools: Read, Grep, Glob, Bash   # optional — omit to inherit every tool
---

System prompt for the agent.
```

Narrow jobs only. Broad agents re-derive context the main session already has.
