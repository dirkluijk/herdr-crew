---
id: CREW-10
title: 'Prompt guard: do not submit into a draft the user is typing'
status: Done
assignee:
  - '@m3-skill'
created_date: '2026-11-13 11:39'
updated_date: '2026-11-13 11:58'
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
- [x] #1 A helper detects an empty input box versus a draft, covered by tests on captured screens
- [x] #2 herdr-crew send waits for an empty input box and idle or done status, with a timeout and a clear error
- [x] #3 Dashboard prompt and onboarding actions refuse to submit into a draft
- [x] #4 The herdr-crew skill tells agents to use the send command; a proposal for the herdr-orchestrator skill is recorded
- [x] #5 npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. inputDraft(raw) in lib/screen.mjs: find the input box (last ╹▀ line, ┃ lines above it in the same column and border colour), drop the agent and model line (final run of non-blank lines), return the draft text, empty string for an empty box or the Ask anything placeholder, null when no input box is visible (dialogs, other views). Tests on real captures from a scratch OpenCode pane (redacted) in test/fixtures/screens.
2. lib/send.mjs: readiness(run, target) checks idle or done plus an empty input box; promptWhenReady() rechecks every 2 s until a timeout.
3. server.mjs: herdr-crew send <agent> <text> [--timeout ms] [--interval ms], exit 0 sent, 2 timeout, 1 other errors.
4. lib/actions.mjs promptAgent uses readiness: 409 when a draft is in the box or no input box is visible. Server tests with a stub screen.
5. skills/herdr-crew/SKILL.md: report and send through herdr-crew send (path per the CREW-7 decision). Proposal for herdr-orchestrator report step and upstream feature request text as notes.
6. npm test and npm run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
m3-skill: started steps 1 to 4 while CREW-7 waits for a decision on the skill path; step 5 follows that decision.

m3-skill progress:
- lib/screen.mjs inputDraft(raw): returns the typed text, empty string for an empty box or the Ask anything placeholder, null when no input box is visible. Finds the last ╹▀ edge, takes the ┃ lines above it in the same column and border colour (so toasts and a tool block right above the box are left out), drops the trailing agent and model line (the last run of non-blank lines, also when it wraps, e.g. Buil / d in a narrow pane). Without colours a tool block right above the box would count as a draft: errs on the side of waiting.
- Fixtures: real captures from a scratch OpenCode 2.2.5 pane (m3-probe, closed again) in test/fixtures/screens: home-empty (placeholder plus MCP toast), home-draft1, home-draft2 (multi line via shift+enter), home-wrap, session-empty, session-working, session-draft, question (blocked dialog, no ╹ edge, so null). Project path and MCP name replaced. Tests in test/draft.test.mjs.
- lib/send.mjs: readiness(run, target) = herdr agent get (idle or done) + agent read --source visible --format ansi + inputDraft; promptWhenReady() rechecks every interval until the timeout. Reasons never contain the draft text. Tests in test/send.test.mjs with a fake herdr and a fake clock.
- server.mjs: herdr-crew send <agent> <text> [--timeout MS default 100000] [--interval MS default 2000]. Exit 0 sent, 2 timeout, 1 other errors (unknown agent, usage, prompt failed). Waiting reasons go to stderr once per change. Default timeout fits in a 2 minute shell tool call.
- lib/actions.mjs promptAgent (dashboard prompt, onboard, onboard all) uses readiness: 409 with the reason when there is a draft or no input box is visible, 502 when herdr agent get fails. Server tests cover 409 no box, 409 draft, 200 empty box, and the send CLI (exit 2 on a draft, 0 on an empty box, 1 on usage) via the stub herdr, which now serves the file in HERDR_CREW_TEST_SCREEN.
- Checked read only against live agents: m2-tests done and x-sjaak idle are ready, crew-orch blocked and m4-snappy working are refused, an unknown name gives agent target ... not found.
- Remaining race: the user can start typing between the screen read and the paste (one herdr call, well under a second). Accepted, documented in lib/send.mjs.
- npm test (85) and npm run check pass. README not touched (m2-tests works on it); the send command is in herdr-crew help.

Upstream feature request draft for Herdr (not filed):

Title: agent prompt: do not submit into a draft the user is typing

herdr agent prompt pastes the text and presses Enter in the target pane. When the user is typing in that agent's input box at the same moment, the prompt is appended to their draft and both are submitted as one message. The agent status does not help here: an agent is idle or done while the user types. We saw this with orchestration setups where one agent reports to another: a report landed in the middle of a sentence the user was writing.

Today the only guard is agent_blocked for approval and question dialogs. We work around it by reading the visible screen and parsing the OpenCode input box before every prompt, which is fragile (it depends on the layout and colours of each agent UI) and leaves a race between the read and the paste.

Proposal: an option such as herdr agent prompt --if-input-empty that refuses with a distinct error (for example agent_input_busy) when the agent input box contains text, and optionally --wait-input-empty --timeout MS to wait until it is empty. Herdr already detects agent UIs per kind, so it is in a better place than callers to know where the input box is, and it can check and write in one step, which closes the race. A related signal in agent get, such as input_empty: true or false, would also let dashboards show that the user is typing.

Proposal for ~/.config/opencode/skills/herdr-orchestrator/SKILL.md (not applied, needs a go from the user):

1. Milestone agent, Report back: replace steps 2 and 3 with
   2. Send one short line. If the project uses herdr-crew (the herdr-crew skill is loaded), use its send command from that skill: it waits until the orchestrator is idle or done and its input box is empty, so the report never lands in a draft the user is typing. Exit code 2 means it timed out: run it again. Otherwise wait with herdr agent wait <orch-name> --timeout 110000 (repeat on a timeout) and send with herdr agent prompt <orch-name> '<line>' without --wait.
   Message format stays: [<name>] <TASK-ids>: <done | blocked | question>. <one sentence>. See task notes.
2. Orchestrator, Start a milestone agent step 5 and Send follow-up work: same rule, prefer the herdr-crew send command for briefings and follow-up prompts when herdr-crew is in use, since the user may be typing in a fresh milestone tab as well.
The herdr-orchestrator skill stays usable without herdr-crew; it only points to the herdr-crew skill for the command and path.

m3-skill: skill text done (commit e83ed7d). The Messages section of skills/herdr-crew/SKILL.md tells every agent to send reports, briefings and follow-up work with node <base>/crew.mjs send <agent> '[name] message' --timeout 110000, explains exit codes 0, 2 (timed out, run again) and 1, and the onboarding line points to send. README documents send and that the dashboard check refuses prompts to non OpenCode agents.

Exact proposal for ~/.config/opencode/skills/herdr-orchestrator/SKILL.md (NOT applied, needs the user's go; replaces the earlier rough proposal):

A. Section Milestone agent, Report back: replace steps 2, 3 and 4 with:

2. Send one short line. Do not put quotes or apostrophes inside the message. Longer content belongs in the task, not in the message.

   With the herdr-crew skill loaded, use its send command. It waits until the orchestrator is idle or done and its input box is empty, so the report does not land in a draft the user is typing:

   ```sh
   node <herdr-crew base>/crew.mjs send <orch-name> '[<name>] <TASK-ids>: <done | blocked | question>. <one sentence>. See task notes.' --timeout 110000
   ```

   Exit code 2 means it timed out: run the same command again.

   Without herdr-crew, wait until the orchestrator is ready for input, then prompt it without --wait. The shell tool has a default timeout of 2 minutes, so wait in chunks and repeat on a timeout error. herdr agent wait also returns when the orchestrator is blocked, so check that its status is idle or done before you prompt:

   ```sh
   herdr agent wait <orch-name> --timeout 110000
   herdr agent prompt <orch-name> '[<name>] <TASK-ids>: <done | blocked | question>. <one sentence>. See task notes.'
   ```

3. Then stop and wait for new instructions. Do not prompt the orchestrator again until it has answered.

B. Section Orchestrator, Start a milestone agent, step 5: replace the first sentence with:
5. Send the briefing without --wait: with herdr-crew through its send command (see Report back), otherwise with herdr agent prompt <name> "<briefing>".

C. Section Orchestrator, Send follow-up work: add as first bullet:
- With herdr-crew, send follow-up work through its send command. It refuses working and blocked agents and waits for an empty input box, so the user can be typing in that tab too.

Why A drops the separate wait step for herdr-crew users: send already waits for idle or done. Seen today: herdr agent wait returned while crew-orch was blocked on a question to the user, so the old step 2 alone did not prevent a prompt into a busy pane.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prompt guard: inputDraft() reads the OpenCode input box from the visible screen, readiness() needs idle or done plus an empty box, herdr-crew send waits with a timeout (exit 2), dashboard prompt and onboarding answer 409. The skill and README tell agents to send through it. Verified with tests on real captured screens, a fake herdr and the stub herdr in the server tests (npm test 85 pass, npm run check ok), read only checks against live agents, and by sending the CREW-7 report to crew-orch with send while it was blocked. Proposal for the herdr-orchestrator skill and an upstream Herdr request are in the notes, not applied or filed.
<!-- SECTION:FINAL_SUMMARY:END -->
