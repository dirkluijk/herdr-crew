---
id: CREW-22
title: Close only agents that belong to this project
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-14 12:57'
updated_date: '2026-11-14 13:04'
labels:
  - actions
  - security
dependencies: []
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the CREW-20 end to end check: a test dashboard for another project offered Close for crew-orch, because crew-orch was a live unregistered agent in the same Herdr workspace (workspace from the inherited HERDR_WORKSPACE_ID). The script cancelled the dialog, nothing happened. User decision 2026-11-14: Close is only allowed when the agent cwd (from herdr agent get or list, cwd or foreground_cwd) is the project, inside it, or a git worktree of it: the same allowedCwd rule as Reopen (lib/agents.mjs). Hide the Close button for other agents (snapshot flag such as canClose) and refuse on the server too. Unregistered agents of the own project stay closable. Also consider showing agents from other projects in the workspace with a small badge (other project) and no actions except Go to; document the choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Close is refused on the server and hidden in the page for agents whose cwd is not the project, inside it, or a git worktree of it
- [x] #2 Unregistered agents of the own project can still be closed
- [x] #3 Tests cover agents from another project in the same workspace; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lib/agents.mjs: projectRoots (project plus git worktrees) and inRoots; Close refuses agents whose cwd (cwd or foreground_cwd from herdr agent get) is outside.
2. lib/crew.mjs: roots cached 30 s; live cards get canClose (own project, not lead, idle or done) and otherProject (unregistered and outside); otherProject is never new.
3. Server: otherProject cards only accept focus. Page: other project badge, only Go to, no chat; Close button from canClose.
4. Tests and a short README note.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Commit 09d9df8 on feat/panels. Decision on other projects: agents of another project in the same Herdr workspace stay visible (useful context) with an ander project / other project badge and a tooltip, only Go to, no chat, and they are left out of New on board and the onboarding banner (before, they counted as new agents to onboard, which is how crew-orch showed up in the CREW-20 test). Server refuses prompt, register, onboard and close for them with 409 (another project); focus still works. Registered personas are always this project, also with a cwd outside: they are not marked other project, but Close is still refused for them by the cwd rule. Stub herdr now answers agent get for extra agents by pane. Validation: npm test 175/175, npm run check ok; unit tests for the cwd refusal (outside, unknown folder) and inRoots; server test with x-other (other folder) and x-own (project/docs) in the same workspace: flags, 409 for close, prompt, register and onboard on x-other with no tab close and no persona written, focus 200, and x-own (unregistered, own project) closes with stored false. Manual: stub instance on 5277, cards selected by agent id: x-other shows ander project with only Ga naar and no chat; m9-probe keeps Informeer and Sluiten.

crew-orch 2026-11-14: rebased, npm test 175 pass, fast-forward merged as 75e9a08 and pushed; restarted 5192 and 5190. On 5190 all live other-project agents (including those in platform-m2) are own project; canClose true for idle non-lead agents.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Close now only works for agents of this project (cwd in the project or a git worktree), on the server and in the page; agents of other projects in the same workspace get an other project badge with only Go to. Verified with npm test (175 pass), npm run check and a stub instance check.
<!-- SECTION:FINAL_SUMMARY:END -->
