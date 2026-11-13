---
id: CREW-3
title: Add the crew line to the herdr-orchestrator briefing template
status: Done
assignee:
  - '@crew-orch'
created_date: '2026-11-13 10:14'
updated_date: '2026-11-13 11:36'
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
- [x] #1 Proposal shown to the user and the go or no-go recorded
- [x] #2 With a go: the briefing template contains the crew line and nothing else in that skill changed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the agreed sentence to the briefing template in the installed herdr-orchestrator skill. 2. Verify with a word diff against a backup that nothing else changed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-13: proposal shown to the user in a grilling round; go given for exactly this sentence in the briefing template: If the project has a .herdr-crew.json, load the herdr-crew skill (own bubble at the end of every turn). Nothing else in that skill changes.

Applied 2026-11-13. Word diff against the backup (opencode temp dir) shows only the inserted sentence in line 55, after Read them in Backlog.md first. 1 insertion, 1 deletion (same line).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The briefing template in ~/.config/opencode/skills/herdr-orchestrator/SKILL.md now contains: If the project has a .herdr-crew.json, load the herdr-crew skill (own bubble at the end of every turn). User gave the go in a grilling round; a word diff against the backup confirms nothing else changed.
<!-- SECTION:FINAL_SUMMARY:END -->
