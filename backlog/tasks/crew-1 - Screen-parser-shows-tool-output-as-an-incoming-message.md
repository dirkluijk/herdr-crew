---
id: CREW-1
title: Screen parser shows tool output as an incoming message
status: To Do
assignee: []
created_date: '2026-11-13 10:14'
labels:
  - parser
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The dashboard shows per agent the last message it received. For live agents it comes from the visible OpenCode screen (herdr agent read --source visible), parsed in lib/screen.mjs parseScreen: a block of lines with the left border ┃ is treated as the last user prompt. Expanded tool calls use the same border. Already skipped: blocks starting with $ (shell), a braille spinner, # and the empty input box (Ask anything plus the agent and model line, fixed 2026-11-13). Still wrong on 2026-11-13: Frank (m3-basics) showed CDK deploy output (Stacks: example-stack ... with green check lines) as an incoming message from Jij. Wrong values are stored in .herdr-crew/memory.json (lastIn) and survive restarts; lib/crew.mjs re-labels or drops stored values at startup. Ideas: read --format ansi and tell user prompt blocks from tool blocks by colour, or take the last user message from the OpenCode session (opencode session export or the OpenCode server API) instead of the screen. Herdr reads must stay on --source visible: deeper reads make the TUI scroll, visible to the user.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tool output in a bordered block is no longer shown as an incoming message, checked against a captured screen with CDK or test output
- [ ] #2 Real prompts from the user, the orchestrator ([agent] or prefix) and the dashboard are still detected
- [ ] #3 Wrong stored values are cleaned up at startup
<!-- AC:END -->
