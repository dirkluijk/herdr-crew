---
id: CREW-3
title: Add the crew line to the herdr-orchestrator briefing template
status: To Do
assignee: []
created_date: '2026-11-13 10:14'
labels:
  - skill
dependencies: []
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The installed herdr-orchestrator skill (~/.config/opencode/skills/herdr-orchestrator/SKILL.md) got one line on 2026-11-13 with the user's go: Prerequisites step 4, if the project has a .herdr-crew.json also load the herdr-crew skill. Its briefing template for milestone agents does not mention the crew conventions yet, so briefings depend on the orchestrator remembering the herdr-crew skill. Proposal: add one sentence to the template, for example: If the project has a .herdr-crew.json, load the herdr-crew skill (own bubble at the end of every turn). Any change in ~/.config needs an explicit go from the user.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Proposal shown to the user and the go or no-go recorded
- [ ] #2 With a go: the briefing template contains the crew line and nothing else in that skill changed
<!-- AC:END -->
