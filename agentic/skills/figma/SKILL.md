---
name: figma
description: Write down what a Figma design actually shows into agentic/tasks/<KEY>/design/ and report its screens. Off by default in spec — its Source table says fetch no, and the design skill reads the links later. Use when a reader or the designer agent is sent a design link, or when asked what a design shows.
---

# Read a design

You are given one Figma URL. You write down what the file shows. You do nothing
else.

A `reader` or the `designer` agent runs you with one link that was found in the
ticket or in the analytics document. Never look for a design yourself.

**Off by default in `spec`.** The `## Source` table below says `fetch | no`.
While it does, `spec` opens no design: it lists the link in the `## Design`
section of `requirements.md`, and `/design <KEY>` reads it later. To read designs
during `spec` instead, change the row to `fetch | yes` and run
`agentic-flow config`.

## Which URLs are yours

A design URL has the host `figma.com`. The path usually contains `/file/`,
`/design/` or `/proto/`. It may end with a `node-id`.

## Which tool to use

Your role is `design`. Open `AGENTS.md`, find the `MCP roles` table, and read the
server name on the `design` row. Use that server's tools.

Ask for as little as the tool allows. If the link has a `node-id`, read only that
node. Without one, ask for the structure of the file first, then read one screen
per call.

Never ask for a screenshot or an image. An image lands whole in your context,
however big it is.

If the tool says its answer was saved to a file, do not `Read` that file whole.
Your agent's instructions say how to read a saved answer.

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

Write one file: `design/<slug>.md`, inside the task folder. The slug is the file
name in lowercase with dashes, for example `design/checkout.md`. One design file
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
written: agentic/tasks/PROJ-123/design/checkout.md
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
| writes | design |
| server | figma |
| auth | none |
| links | stop |
| fetch | no |
