---
id: CREW-15
title: Backlog and markdown widget types
status: To Do
assignee:
  - '@m5-panels'
created_date: '2026-11-13 12:36'
updated_date: '2026-11-13 12:38'
labels:
  - widgets
dependencies: []
priority: medium
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add two built-in declarative widget types next to links and dev-server. 1. backlog: a mini overview of Backlog.md tasks from the crew task data (already followed via backlog task list --json --watch in lib/crew.mjs), options id, title, filters (status, labels, assignee, priority), groupBy (status by default), limit; rows open the task modal (CREW-13). Read only. 2. markdown: shows one project file rendered with lib/markdown.mjs inside the panel (for example PLAN.md or a section of it), options id, title, file (relative to the project, same real path rules as the links widget), maxHeight; content refreshes when the file changes. No scripts, no files outside the project. Widget modules follow the existing contract in README (create returns id, title, view, actions, log) and the page renders them generically. Document both in README. Context: user decision 2026-11-13, panels are only built-in declarative widget types (see CREW-16).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A backlog widget shows filtered and grouped tasks that update live and open the task modal
- [ ] #2 A markdown widget shows a project file safely and updates when the file changes; paths outside the project are refused
- [ ] #3 README documents both types with examples
- [ ] #4 Tests cover options validation, filtering and the path rules; npm test and npm run check pass
<!-- AC:END -->
