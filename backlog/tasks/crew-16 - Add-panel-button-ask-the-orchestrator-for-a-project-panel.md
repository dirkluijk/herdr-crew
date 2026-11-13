---
id: CREW-16
title: 'Add panel button: ask the orchestrator for a project panel'
status: To Do
assignee: []
created_date: '2026-11-13 12:37'
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
- [ ] #1 The header has an Add panel button; a confirmed prompt reaches the live lead persona through the draft guard, or the dialog explains why not
- [ ] #2 herdr-crew widget add and widget remove validate entries and update .herdr-crew.json
- [ ] #3 The herdr-crew skill tells the orchestrator how to turn a panel request into a widget entry
- [ ] #4 End to end: a prompt for a backlog overview and one for a link to PLAN.md each result in a working panel without restart
- [ ] #5 Tests cover the action, the CLI validation and the message template; npm test and npm run check pass
<!-- AC:END -->
