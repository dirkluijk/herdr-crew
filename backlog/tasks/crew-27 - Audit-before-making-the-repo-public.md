---
id: CREW-27
title: Audit before making the repo public
status: To Do
assignee: []
created_date: '2026-11-14 12:58'
updated_date: '2026-11-14 13:41'
labels:
  - release
dependencies: []
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Do this when the user wants to make dirkluijk/herdr-crew public (decision 2026-11-14: private first, public later). Check the full git history for secrets again (keys, tokens, the Foundry host), check backlog/, PLAN.md and README for references to other projects, employers or internal names (other-project, NS, Platform, Foundry resource names, personal paths) and decide what stays, check avatars and example configs, decide whether backlog/ ships, add a short CONTRIBUTING or issue guidance if wanted, then flip visibility with gh repo edit --visibility public only after the user's explicit go.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 History and files checked, findings and decisions recorded
- [ ] #2 Visibility changed only after the user's explicit go
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-14: the user wants to keep the repo private for now; do not start this audit until the user asks.
<!-- SECTION:NOTES:END -->
