---
id: CREW-18
title: Close and reopen agents from the dashboard
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-13 13:19'
updated_date: '2026-11-13 13:30'
labels:
  - ui
  - actions
dependencies: []
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request 2026-11-13: close agents from the dashboard and reopen them later. Decisions by the user (grilling 2026-11-13): 1. Close = herdr tab close on the agent tab; OpenCode stops, the session stays on disk; only allowed when the agent pane is the only pane in that tab (never close a tab that also holds the dashboard or other panes). 2. Close only when the agent is idle or done, after a fresh status check, like chat; never for working or blocked agents. 3. No close button for the lead persona (orchestrator). 4. Reopen resumes the same OpenCode session: create a tab in the crew workspace (herdr tab create --workspace <ws> --cwd <cwd> --label <same label> --no-focus), read the pane id from .result.root_pane.pane_id, then herdr agent start <agent> --kind opencode --pane <pane> --timeout 60000 -- --session <ses_id>. No new briefing. Session id: live agents expose agent_session.value in herdr agent list; on close store it in the persona (session field in .herdr-crew.json through registerPersona, which closed cards already use for last words) together with the cwd, so reopen also works after a dashboard restart. Reopen only for personas with a valid ses_ id, only when the agent name is not live elsewhere on the Herdr server (names are global), only for kind opencode. Guards: Host, Origin, X-Crew, confirmed, actions.log, fixed command map through execFile, no user supplied pane ids, cwd only from the stored value and only inside or equal to the project or a known worktree path (decide and document). Keep .herdr-crew.json backward compatible (session and cwd are optional fields).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Live non-lead cards that are idle or done have a Close button; after confirmation the agent tab closes, the session id is stored and the card turns closed
- [x] #2 Close is refused for working or blocked agents, the lead persona, and tabs with more than one pane
- [x] #3 Closed cards with a stored OpenCode session have a Reopen button that starts the same session in a new tab with the same label and agent name
- [x] #4 Reopen is refused when the agent name is live elsewhere or no valid session is stored
- [x] #5 Every close and reopen is confirmed and logged in actions.log; README documents both
- [x] #6 Tests cover the guards and the command sequence with stub herdr; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. validPersona accepts optional session (ses_ id) and cwd (absolute path), so registerPersona can store them; config stays compatible.
2. lib/agents.mjs (new): closeAgent and reopenAgent with a fixed herdr command map through execFile. Close: lead refused; fresh herdr agent get (same pane and name, idle or done); herdr tab get pane_count must be 1; store session and cwd for registered personas (opencode with a ses_ id only); herdr tab close. Reopen: registered persona with a valid ses_ id; name not live anywhere (fresh herdr agent list); cwd = stored cwd or the project, must be the project, inside it, or inside a git worktree of the project (git worktree list --porcelain); crew workspace known; herdr tab create with the same label, root pane from .result.root_pane.pane_id, herdr agent start <agent> --kind opencode --pane <pane> --timeout 60000 -- --session <ses>; on a failed start close the new tab. One action per agent at a time.
3. Routes POST /api/agents/<id>/close and /reopen with Host, Origin, X-Crew, confirmed, actions.log; snapshot gets canClose hints and canReopen for closed cards.
4. Page: Close on live non-lead idle or done cards, Reopen on closed cards with a session, both through a confirm dialog.
5. Stub herdr with a state file (status, pane count, start failure, extra live agents) and a stub opencode; tests for guards and command sequences. README.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on feat/panels, commit e5db88d.
- lib/agents.mjs: createAgentControl with a fixed herdr command map (agent get, agent list, tab get, tab close, tab create, agent start) through the existing execFile exec; pane and tab ids only from Herdr output (checked against [A-Za-z0-9_:-]). One close or reopen per agent at a time.
- Close: lead refused; fresh herdr agent get must show the same pane and name and idle or done; herdr tab get pane_count must be 1; for a registered persona and agent kind opencode with a ses_ id, registerPersona stores session and cwd (validPersona now accepts both, optional, so old configs load); then herdr tab close. Unregistered or non-OpenCode agents can be closed but nothing is stored (confirm text says so).
- Reopen: route only for agents that are not live in the snapshot; persona with a valid ses_ id; fresh herdr agent list must have no agent with that name anywhere; cwd rule (decision): stored cwd or the project, realpath must be an existing dir equal to or inside the project or a git worktree from git worktree list --porcelain (covers milestone worktrees like this one); crew workspace from the snapshot (workspace config, HERDR_WORKSPACE_ID, or most common); label = last tab label from memory, else <agent> (<Name>, <pronouns>); herdr tab create ... --no-focus, pane from .result.root_pane.pane_id, herdr agent start <agent> --kind opencode --pane <pane> --timeout 60000 -- --session <ses>; on a failed start the new tab is closed. No briefing.
- Snapshot: closed cards get canReopen. Page: ⏻ Sluiten on live non-lead idle or done cards, ↻ Heropenen on closed cards with a session, both through a new confirm dialog; toast after success.
- actions.log: close with tab, label, session, cwd; reopen with workspace, tab, pane, label, cwd, session.
- Test stubs: herdr stub reads HERDR_CREW_TEST_STATE (status, panes, startFail, createNoPane, extraAgents) and answers tab get, tab create and agent get with session and cwd; new stub opencode so a stored session never reaches the real OpenCode.
Validation: npm test 159/159 (twice), npm run check ok. test/agents.test.mjs: close sequence and stored fields, refusals (lead, working, blocked, other pane or name, 2 panes, unknown pane count, failed tab close), unregistered and non-OpenCode close, reopen sequence and label, fallback label and project cwd, refusals (no or bad session, unknown persona, name live elsewhere, list failure, cwd outside, symlink out, missing dir, no workspace), failed start closes the tab, missing pane id, one action at a time, allowedCwd with worktrees. server.test.mjs: route guards (403, 400), close refusals and success with stored session and log, lead refused, reopen refused for live and sessionless agents, success command sequence and log, failed start cleanup. Manual: own instance on 5277 with the stub herdr on PATH (no real Herdr calls), headless Chrome: Close and Reopen buttons on the right cards, both confirm dialogs, toasts, stub log shows tab close, tab create and agent start, actions.log lines and the stored session in the persona. No real agents were closed or started.

crew-orch 2026-11-13: reviewed, rebased onto main, npm test 159 pass, fast-forward merged as 43ed8a2 and pushed; restarted 5192 and 5190 (both 200). Closed personas from before CREW-18 have no stored session, so canReopen is false for them.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Close for idle or done non-lead agents (closes the single-pane tab, stores session and cwd) and Reopen for closed personas with a stored OpenCode session (new tab with the same label and name, same session), with the guards from the task and a documented cwd rule (project, inside it, or a git worktree of it). Verified with npm test (159 pass), npm run check and a headless Chrome check on an own instance with stub herdr.
<!-- SECTION:FINAL_SUMMARY:END -->
