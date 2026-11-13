---
id: CREW-10
title: 'Prompt guard: do not submit into a draft the user is typing'
status: To Do
assignee:
  - '@m3-skill'
created_date: '2026-11-13 11:39'
labels:
  - skill
  - bug
dependencies:
  - CREW-7
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Problem: herdr agent prompt pastes text plus Enter into the target pane. If the user is typing a draft in that OpenCode input box, the message is appended to the draft and submitted together, mixing two messages. Seen live on 2026-11-13: a report from the other-project orchestrator landed in the middle of a sentence the user was typing to crew-orch. The agent status is idle or done while the user types, so the status check in herdr and in lib/actions.mjs does not help. herdr agent prompt has no option for this (only agent_blocked is checked). Detection: the visible screen (herdr agent read --source visible --format ansi) shows the OpenCode input box; empty means the placeholder Ask anything plus the agent and model line, a draft shows the typed text. lib/screen.mjs parseScreen already locates the input box. Plan: 1. export an inputDraft(screen) or inputEmpty(screen) helper in lib/screen.mjs with tests on captured, redacted screens (empty box, one line draft, multi line draft, blocked dialog). 2. Add a CLI command to server.mjs, e.g. herdr-crew send <agent> <text> [--timeout ms]: resolve the agent, require idle or done, require an empty input box, otherwise wait and recheck every 2 s until the timeout, then herdr agent prompt; exit non-zero with a clear message on timeout. 3. Use the same guard in the dashboard prompt and onboarding actions (409 with a message such as waiting for your draft). 4. Update skills/herdr-crew/SKILL.md so agents report and send through this command (path via the skill base directory, see CREW-7) and write a proposal for the report step in ~/.config/opencode/skills/herdr-orchestrator/SKILL.md; changing ~/.config needs an explicit go from the user. 5. Draft an upstream feature request text for Herdr (e.g. agent prompt --if-input-empty) as a note in this task, do not file it. Remaining race (user starts typing between check and send) is accepted and documented. Constraints: dashboards on 5190 and 5192 run from this checkout; do not restart them; Herdr reads only with --source visible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A helper detects an empty input box versus a draft, covered by tests on captured screens
- [ ] #2 herdr-crew send waits for an empty input box and idle or done status, with a timeout and a clear error
- [ ] #3 Dashboard prompt and onboarding actions refuse to submit into a draft
- [ ] #4 The herdr-crew skill tells agents to use the send command; a proposal for the herdr-orchestrator skill is recorded
- [ ] #5 npm test and npm run check pass
<!-- AC:END -->
