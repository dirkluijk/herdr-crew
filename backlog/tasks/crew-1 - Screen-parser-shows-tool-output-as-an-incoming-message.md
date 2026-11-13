---
id: CREW-1
title: Screen parser shows tool output as an incoming message
status: Done
assignee:
  - '@m1-parser'
created_date: '2026-11-13 10:14'
updated_date: '2026-11-13 10:32'
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
- [x] #1 Tool output in a bordered block is no longer shown as an incoming message, checked against a captured screen with CDK or test output
- [x] #2 Real prompts from the user, the orchestrator ([agent] or prefix) and the dashboard are still detected
- [x] #3 Wrong stored values are cleaned up at startup
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the visible screen with --format ansi (still --source visible) and pass the raw ANSI to parseScreen.
2. In parseScreen, classify bordered blocks by colour: OpenCode draws the border of tool blocks (shell, question, CDK or test output) in the screen background colour, user prompts in the agent colour. Fall back to text heuristics when there is no colour info.
3. Never take a block that is cut off at the top of the viewport as the prompt (its start and sender prefix are unknown).
4. Export looksLikeToolOutput(text) from lib/screen.mjs and use it in lib/crew.mjs at startup to drop stored lastIn values from the screen that look like tool output, and clear promptSeen so a visible prompt is picked up again.
5. test/screen.test.mjs with node:test: captured screen structure (redacted, synthetic text), CDK and test output blocks, truncated block, empty input box, prompts from user, [agent] and prefix, plain text fallback, startup cleanup predicate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Orchestrator crew-orch 2026-11-13: assigned to milestone agent m1-parser (Pim). Split with CREW-8: m1-parser owns lib/screen.mjs, the startup cleanup in lib/crew.mjs and test/screen.test.mjs (parseScreen cases from CREW-8). m2-tests owns the rest of the suite and the npm test script in package.json. Constraints: the other-project dashboard (port 5190, pane w2B:pZ) runs from this checkout; do not restart or stop it, do not touch public/index.html, keep .herdr-crew.json backward compatible. Herdr reads only with --source visible. Captured screens used as fixtures must be redacted (no secrets, customer data or tokens).

Findings 2026-11-13: in --format ansi the left border of tool blocks has fg equal to the screen background (tokyonight: 38;2;26;27;38 on bg 30;32;48), user prompt borders use the agent colour (122;162;247 Build, 187;154;247 Plan). The plain text read cannot tell them apart. Likely cause of the CDK case: a long shell block whose first line ($ command) had scrolled above the viewport, so the dollar heuristic missed it.

Implemented: lib/crew.mjs reads --source visible --format ansi (plain text read as fallback). lib/screen.mjs: borderIsTool() classifies each bordered line by colour, adjacent blocks with a different border colour are split (also against the input box), a block cut off at the top of the viewport is never taken as the prompt, looksLikeToolOutput() is the text fallback and the startup predicate. Startup cleanup drops screen lastIn values without a known sender that look like tool output, and clears promptSeen so a visible prompt is re-detected. Dashboard values stay untouched.
Validation: node --test test/screen.test.mjs 15/15 pass (CDK and node:test output, truncated blocks, question and shell blocks, prompts from user, [agent] and Noor prefix, Plan colour, empty input box, plain text fallback, startup cleanup on a temp memory.json). npm run check ok. Ran parseScreen over 21 live visible ANSI captures: no tool block taken as prompt, prompts as expected (captures kept outside the repo, fixtures are synthetic with the captured escape sequences).
Note: the running dashboards (5190 and others) keep the old code until someone restarts them; the cleanup runs at that next start. For m2-tests: test/screen.test.mjs is mine, it needs to be included in npm test (node --test test/).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tool blocks are now told apart from prompts by border colour in the ANSI visible read, with text heuristics as fallback and truncated blocks ignored. Wrong stored lastIn values are cleaned at startup. Verified with test/screen.test.mjs (15 tests) and live captures.
<!-- SECTION:FINAL_SUMMARY:END -->
