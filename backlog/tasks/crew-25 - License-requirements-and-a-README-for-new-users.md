---
id: CREW-25
title: 'License, requirements and a README for new users'
status: In Progress
assignee:
  - '@m6-release'
created_date: '2026-11-14 12:58'
updated_date: '2026-11-14 13:29'
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
- [ ] #4 README.md is short and readable for new users, with emoji and the hero image, and links to DESIGN.md
- [ ] #5 DESIGN.md contains all reference detail that left the README, with no facts lost
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-14: scope change by the user: make the README user ready. README.md becomes simple and straightforward for humans, with emoji and an image: what it is, a hero image, why, requirements in short, install (clone, install, doctor), quick start (say maak een nieuwe Herdr crew or run /crew), what you see in the dashboard, uninstall, links. All the detail (configuration reference, persona fields, widgets and their options, panels, languages, safeguards, environment variables, CLI reference, limitations, architecture) moves to a new DESIGN.md, which README links to. Keep facts unchanged, only restructure and rewrite; let the writer subagent write the prose (emoji are explicitly wanted by the user here; still no em dashes or en dashes). Image: the orchestrator makes a hero illustration at docs/hero.png; add a dashboard screenshot only from your own instance with fictional personas and tasks (no real project names), for example docs/dashboard.png. Do not touch PLAN.md beyond a pointer to DESIGN.md if needed.
<!-- SECTION:NOTES:END -->
