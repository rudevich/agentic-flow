---
name: figma
description: Write down what a Figma design actually shows into agentic/tasks/<KEY>/sources/design/ and report its screens. Use when a reader agent is sent a design link, or when asked to list the screens of a design for a ticket.
---

# Read a design

You are given one Figma URL. You write down what the file shows. You do nothing
else.

A `reader` agent runs you with one link that was found in the ticket or in the
analytics document. Never look for a design yourself.

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

Write one file: `sources/design/<slug>.md`. The slug is the file name in
lowercase with dashes, for example `sources/design/checkout.md`. One design file
is one snapshot, so two designs never land on top of each other.

Copy the shape below.

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

## What to report back

Answer in exactly this shape, and nothing else:

```
source: figma
url: https://www.figma.com/design/abc123/Checkout?node-id=12-34
written: agentic/tasks/PROJ-123/sources/design/checkout.md
facts:
- Cart: states present are default and one item
- Cart: the button says "Checkout"
- not in the file: empty state, error state
links: none
```

`facts` is at most 25 lines, one line each, the screen name first. Say which
states a screen has, and add one `not in the file` line for the states nobody
drew. Do not turn a fact into a requirement: that is the specificator's job.

`links` is always `none`. Links inside a design file are not followed. The chain
of sources ends with you.

## If you cannot read the file

Two cases, and both end the same way:

- there is no MCP server for the `design` role;
- the file URL does not load.

Write no file. Answer in this shape:

```
source: figma
url: https://www.figma.com/design/abc123/Checkout
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
| writes | sources/design |
| server | figma |
| auth | none |
| links | stop |
