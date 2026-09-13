# Hooks

Executable scripts run by the harness around tool calls and session events —
format after an edit, block a forbidden command, notify on stop.

```
hooks/
└── format-on-edit.sh
```

`chmod +x` them, then wire up in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "$CLAUDE_PROJECT_DIR/agentic/hooks/format-on-edit.sh" }]
      }
    ]
  }
}
```

- Event payload arrives as JSON on stdin.
- Non-zero exit + stderr → that output goes back to the agent.
