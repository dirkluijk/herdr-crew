---
id: CREW-17
title: Agents briefed by the orchestrator show up as new
status: To Do
assignee:
  - '@crew-orch'
created_date: '2026-11-13 12:40'
labels:
  - bug
dependencies: []
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A registered agent counted as new (isNew in lib/crew.mjs) until it set its first own bubble or was informed through the dashboard. The orchestrator registers a persona before starting an agent and then briefs it, but the first bubble only comes at the end of that first turn, so the dashboard showed the banner 1 new agent without persona or bubble, onboarding is work for Noor, for m5-panels (Daan) on 2026-11-13 while its card already had persona and avatar.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A registered agent whose last incoming screen message came from the lead persona counts as informed (informedVia briefing)
- [ ] #2 Unregistered agents and messages from others or the dashboard keep the old behaviour
- [ ] #3 Unit tests cover the rule; npm test passes
<!-- AC:END -->
