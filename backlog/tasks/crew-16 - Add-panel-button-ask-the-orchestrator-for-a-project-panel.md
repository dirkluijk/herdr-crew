---
id: CREW-16
title: 'Add panel button: ask the orchestrator for a project panel'
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-13 12:37'
updated_date: '2026-11-13 13:04'
labels:
  - widgets
  - ui
  - skill
dependencies:
  - CREW-14
  - CREW-15
priority: medium
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User idea 2026-11-13: a default Add panel button in the dashboard header where the user types a prompt such as a mini overview of all backlog tasks or a link to the plan, and gets a custom project panel. Decisions by the user (grilling 2026-11-13): the orchestrator (lead persona) turns the prompt into a panel, not a server side model call; panels are only built-in declarative widget types (links, backlog, markdown, dev-server), never generated HTML or code; panels appear without restart (CREW-14). Build: 1. Add panel button and dialog in public/index.html; on confirm, a POST action sends a message to the lead persona through the same guard as chat (idle or done and an empty input box, see CREW-10), using an onboarding-like template with the prefix of the dashboard, the user prompt, the list of widget types with their options, and the exact CLI command to use; with no live lead, explain that in the dialog. 2. A CLI command, e.g. herdr-crew widget add --project DIR --json '<entry>' and widget remove <id>, that validates the entry against the known types (and their option validation), refuses duplicate ids and writes .herdr-crew.json, like register does for personas. 3. A Panels section in skills/herdr-crew/SKILL.md for the orchestrator: how to pick a type, fill options from the project, run widget add, and confirm to the user. 4. README. Guards: Host, Origin, X-Crew, confirmation, actions.log; the user prompt is plain text sent to the lead, it is never executed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header has an Add panel button; a confirmed prompt reaches the live lead persona through the draft guard, or the dialog explains why not
- [x] #2 herdr-crew widget add and widget remove validate entries and update .herdr-crew.json
- [x] #3 The herdr-crew skill tells the orchestrator how to turn a panel request into a widget entry
- [x] #4 End to end: a prompt for a backlog overview and one for a link to PLAN.md each result in a working panel without restart
- [x] #5 Tests cover the action, the CLI validation and the message template; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shared option checks (lib/widget-options.mjs) and validate(options) for all four built-in types.
2. lib/panels.mjs: PANEL_TYPES, entryId, validateEntry (only built-in types, options, duplicate ids, files exist inside the project), addWidget, removeWidget, cleanPrompt and the message template.
3. CLI: herdr-crew widget add --json, widget remove <id>, widget list.
4. POST /api/panels/request in lib/actions.mjs with the usual guards and the draft guard of chat; GET gives lead info and the exact message for a prompt.
5. Page: Add panel button and dialog, with an explanation when there is no live lead, then the existing confirm step.
6. Skill Panels section, README Add panel section, PLAN file map; tests; end to end check with own instance and own test lead.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on feat/panels, commit ec65472.
- lib/widget-options.mjs shared checks; links and dev-server got validate(options) for the CLI only (create stays lenient, so existing configs keep loading); backlog and markdown now also refuse unknown option keys.
- lib/panels.mjs: only backlog, markdown, links, dev-server (no path modules, prototype names refused); id is options.id or the type default (dev-<port>); listed files must exist inside the project (real path). addWidget keeps other keys; removeWidget removes the first entry with the id. cleanPrompt strips control characters except newlines; the prompt is quoted on > lines in a fixed nl/en template with the types, options and the exact widget add command (cli from HERDR_CREW_CLI or node <checkout>/server.mjs).
- CLI: widget add --json, widget remove <id>, widget list; needs an existing .herdr-crew.json; exit 1 with the problems.
- /api/panels/request: GET gives lead, live, status and (with ?prompt=) the exact message; POST needs Origin + X-Crew, confirmed, 1..500 characters, a lead persona and a live lead, then goes through promptAgent (idle or done and empty input box) and actions.log (action panel request).
- Page: ＋ Paneel / ＋ Panel in the header; dialog explains no lead or lead not live and sends nothing; otherwise Next shows the existing confirm step with the exact message; toast after sending.
- Skill: Panels section under Orchestrator (text drafted by the writer subagent from the facts), description mentions panel requests. README Add panel section and CLI line, PLAN file map.
Validation: npm test 146/146, npm run check ok. test/panels.test.mjs (types, entries, ids, files, links and dev-server validation, add/remove, prompt cleaning, template). Server tests: widget CLI add errors, add shows panel live, list, remove; panel request guards (403, 400, 409 no lead), then with lead: draft blocks (409, no prompt sent), empty box sends exactly the previewed text, actions.log line.
End to end (AC 4): own instance on 5277/5278 against a throwaway project in the session temp dir (PLAN.md and backlog/ copied from main), with HERDR_CREW_CLI pointing to a symlink of the worktree server.mjs inside that project; own test lead m5-testlead (Lotte) started in its own Herdr tab, not crew-orch. Before the lead ran, the dialog said Lotte is not running and offered no send. Prompt een mini-overzicht van alle open backlog-taken: confirmed via headless Chrome, Lotte ran widget add, panel Open taken (backlog, status To Do and In Progress) appeared without restart and its row opened the CREW-16 modal. Prompt een link naar PLAN.md: Lotte added links panel Plan, the files origin started lazily and served PLAN.md (200). Both requests logged in actions.log. Test tab closed and instance stopped afterwards; 5190 and 5192 untouched.
Follow-up idea, not done: the dialog does not show when the lead finished; the user sees the new panel or the lead answer in its pane.

crew-orch 2026-11-13: rebased onto main, npm test 146 pass, reviewed the Panels section (request treated as a description, not instructions; only built-in types); fast-forward merged and pushed. Restarted 5192 and 5190.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the Add panel button and dialog, the panel request action to the live lead through the draft guard, the widget add, remove and list CLI with validation against the four built-in types, and a Panels section in the herdr-crew skill. Verified with npm test (146 pass), npm run check and an end to end run with an own instance and an own test lead: a backlog overview and a link to PLAN.md each became a working panel without restart.
<!-- SECTION:FINAL_SUMMARY:END -->
