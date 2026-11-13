---
id: CREW-20
title: Add a dashboard language through the orchestrator
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-13 13:22'
updated_date: '2026-11-13 15:06'
labels:
  - i18n
  - skill
dependencies:
  - CREW-19
priority: low
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-11-13 (grilling): new UI languages are made by the orchestrator, not by a server side model call, like the Add panel flow (CREW-16). Build: 1. CLI commands crew.mjs locale list, locale check <file> and locale add <code> --file <path> --project DIR (or into the checkout locales/, decide and document where project specific locales live): validate against en.json (same keys, same placeholders, no empty strings, sane length) and save; locale add refuses invalid files and prints the problems. 2. In the dashboard language picker an option Add language that, after confirmation, sends a request to the live lead through the draft guard with the language name, the path of en.json and the exact commands. 3. A Languages section in skills/herdr-crew/SKILL.md for the orchestrator: translate en.json faithfully, keep placeholders, keep confirmation and safety texts literal and complete (they explain what an action does), run locale check, then locale add, and tell the user. 4. README. End to end: request German through the dashboard, the orchestrator adds de, the picker offers it and the UI switches without restart.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 locale check and locale add validate and store a locale file
- [x] #2 The dashboard can request a new language from the lead through the draft guard
- [x] #3 The herdr-crew skill has a Languages section for the orchestrator
- [x] #4 End to end: a requested language becomes selectable and switches the UI without restart
- [x] #5 Tests cover validation and the request message; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lib/languages.mjs: project languages in <project>/.herdr-crew/locales/<code>.json (decision: the checkout stays read only; shared languages go into locales/ through a PR), checkLocaleFile and addLocale (validates against en.json, refuses shipped codes and bad codes, writes through tmp plus rename), languageRequestText.
2. CLI: locale list, locale check <file>, locale add <code> --file <file> --project DIR.
3. Server: i18n reads the project locale dir too (dir mtime, no restart); POST /api/languages/request shares the lead request handler with panels (guards, draft guard, actions.log).
4. Page: Add language in the 🌐 dialog, project languages tagged, list refreshed on open.
5. Skill Languages section, README, PLAN; tests; end to end with own instance and own test lead.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Commit 09f019a on feat/panels.
- lib/i18n.mjs: languages() now marks project languages (project: true); extra dirs only add languages that pass checkLocale and never replace en or nl.
- lib/actions.mjs: one handler for lead requests (/api/panels/request and /api/languages/request), field, max and template per route; language name max 60 characters, control characters removed.
- Locale keys added in en and nl: ui.addLanguage, ui.addLanguageTitle, ui.languagePh, ui.languageAddHint, ui.languageNoLead, ui.languageSent, ui.languageProject, languages.head/translate/rules/commands/end.
- Skill Languages section and README text drafted by the writer subagent from the facts.
Validation: npm test 173/173, npm run check ok. test/languages.test.mjs (file check, add refusals and update, project language in i18n, request text). server.test.mjs: locale check and add through the CLI, de offered in /api/config without restart and selectable, request guards, no lead 409, with lead the previewed text goes through the draft guard, actions.log line.
End to end (AC 4): own instance on 5277 run from a copy of the worktree inside a throwaway project (so en.json is inside the test lead cwd), own test lead m5-testlead (Lotte) in its own tab, not crew-orch. Requested Duits through 🌐, Taal toevoegen, confirm: Lotte wrote the draft, locale check passed first time, locale add stored de.json (about 1 minute). The picker then listed Deutsch (de, dit project); choosing it switched the page to German without restart (Die e2e-lang-Crew, arbeitet, wartet, footer and Close dialog in German), bubbleLanguage stayed nl, actions.log has language request and language set. Test tab closed, instance stopped.
Incident during the manual check: my scripted step opened the Close dialog on the first card with a Close button, which in that instance was Noor (crew-orch, shown as unregistered in the test project). The script cancelled the dialog; no request was sent, actions.log has no close line and crew-orch stayed live. Future scripted checks should target a card by agent id.

crew-orch 2026-11-13: rebased onto main, npm test 173 pass, fast-forward merged as d7511e0 and pushed; restarted 5192 and 5190. Follow-ups from review: the Close incident shows that a dashboard can offer Close for unregistered agents of another project in the same Herdr workspace (CREW-22), and project languages live in .herdr-crew/locales, which is gitignored, so they are not versioned with the project (decision pending).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Add language in the 🌐 dialog (confirmed request to the live lead through the draft guard), herdr-crew locale list, check and add with validation against en.json and project languages in .herdr-crew/locales, and a Languages section in the skill. Verified with npm test (173 pass), npm run check and an end to end run with an own instance and an own test lead: German was added and the UI switched without restart.
<!-- SECTION:FINAL_SUMMARY:END -->
