---
id: CREW-20
title: Add a dashboard language through the orchestrator
status: To Do
assignee: []
created_date: '2026-11-13 13:22'
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
- [ ] #1 locale check and locale add validate and store a locale file
- [ ] #2 The dashboard can request a new language from the lead through the draft guard
- [ ] #3 The herdr-crew skill has a Languages section for the orchestrator
- [ ] #4 End to end: a requested language becomes selectable and switches the UI without restart
- [ ] #5 Tests cover validation and the request message; npm test and npm run check pass
<!-- AC:END -->
