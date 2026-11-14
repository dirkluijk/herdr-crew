---
id: CREW-25
title: 'License, requirements and a README for new users'
status: To Do
assignee:
  - '@m6-release'
created_date: '2026-11-14 12:58'
labels:
  - docs
  - release
dependencies:
  - CREW-24
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal (user 2026-11-14): the repo must be usable by anyone with Herdr. package.json says MIT but there is no LICENSE file. User decision: MIT, holder Dirk Luijk, year 2026. README: start with what herdr-crew is and a screenshot placeholder, then Requirements (Node 22+, Herdr with the features used, OpenCode as the best supported agent and what works for other agents, optional Backlog.md with minimal version for --json and --watch, optional model credentials, macOS versus Linux, Windows not supported), Install (git clone, node server.mjs install, node server.mjs doctor), Quick start (say maak een nieuwe Herdr crew or run /crew, see CREW-26), Uninstall, then the existing reference sections. Keep it factual; write prose with the writer subagent if available. No em dashes or en dashes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 LICENSE contains the MIT license for Dirk Luijk, 2026
- [ ] #2 README has Requirements, Install, Quick start and Uninstall sections that match install and doctor
- [ ] #3 No personal paths or project names from other projects in README
<!-- AC:END -->
