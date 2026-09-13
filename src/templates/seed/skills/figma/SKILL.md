---
name: figma
description: Write down what a Figma design actually shows into agentic/tasks/<KEY>/sources/design.md. Use when the spec skill sends a design link here, or when asked to list the screens of a design for a ticket.
---

# Read a design

You are given one Figma URL. You write down what the file shows. You do nothing
else.

The `spec` skill gives you a link it found in the ticket or in the analytics
document. Never look for a design yourself.

## Which URLs are yours

A design URL has the host `figma.com`. The path usually contains `/file/`,
`/design/` or `/proto/`. It may end with a `node-id`.

## Which tool to use

Your role is `design`. Open `AGENTS.md`, find the `MCP roles` table, and read the
server name on the `design` row. Use that server's tools.

Figma does not use an API token like the other sources. It connects in one of two
ways:

- the Dev Mode MCP server, started from the Figma desktop application;
- an OAuth connector, authorised with `/mcp` in an interactive session.

If the `design` row is empty, go to "If you cannot read the file".

## What to copy

Write down only what you can see in the file:

- the screens, and which states each screen actually has;
- the text on the screens, word for word;
- component names, design tokens, the spacing scale;
- the `node-id` from the link, if it had one.

Do not add anything you did not see. A state that is not drawn does not exist.
List it under `Not in the file` instead.

Example: the file shows a cart with three items and a cart with one item. It
shows no empty cart and no error. So "empty cart" and "error" go under
`Not in the file`, and you write no requirement about them.

## What to write

Write one file: `sources/design.md`. Copy the shape below.

```markdown
# Design — <file name>

**Ticket:** https://co.atlassian.net/browse/PROJ-123
**Source:** https://www.figma.com/design/abc123/Checkout?node-id=12-34
_fetched 2026-09-13 14:20_

## Screens

### Cart — states present: default, one item

- text: "Your cart", "Checkout"
- components: CartRow, PrimaryButton

## Not in the file

- empty state
- error state
- offline state
```

Use the current date and time. Do not copy the example.

Replace every `<…>` with a real value. No angle brackets may remain in what you
write.

If you were given more than one design link, put one section per file here. Each
section gets its own `**Source:**` line.

## What to report back

Answer `spec` in exactly this shape, and nothing else:

```
written: agentic/tasks/PROJ-123/sources/design.md
links: none
```

`links` is always `none`. Links inside a design file are not followed. The chain
of sources ends with you.

## If you cannot read the file

Two cases, and both end the same way:

- there is no MCP server for the `design` role;
- the file URL does not load.

Write no file. Answer in this shape:

```
written: none
reason: no MCP server for the design role
```

Never describe screens you could not open. Never rebuild the design from the
analytics document: the snapshot exists exactly to show when the two disagree.

## Source

What `spec` routes by and what `agentic-flow` wires up. Keep it accurate.

| Field | Value |
| --- | --- |
| role | design |
| matches | figma.com |
| writes | sources/design.md |
| server | figma |
| auth | none |
| links | stop |
