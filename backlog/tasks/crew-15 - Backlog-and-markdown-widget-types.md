---
id: CREW-15
title: Backlog and markdown widget types
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-13 12:36'
updated_date: '2026-11-13 12:54'
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
- [x] #1 A backlog widget shows filtered and grouped tasks that update live and open the task modal
- [x] #2 A markdown widget shows a project file safely and updates when the file changes; paths outside the project are refused
- [x] #3 README documents both types with examples
- [x] #4 Tests cover options validation, filtering and the path rules; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. crew.mjs: keep labels, priority and ordinal per task and expose tasks() for widgets; widget set passes a backlog context (enabled, tasks) to create.
2. widgets/backlog.mjs: validate(options) (id, title, filters status/labels/assignee/priority as string or array, groupBy status|priority|assignee|label|none, limit 1..200), filter, sort (priority, then ordinal, then id), group (status order To Do, In Progress, Done, then others), limit with a more count. View returns groups with rows; read only.
3. widgets/markdown.mjs: validate(options) (id, title, file required, section, maxHeight), same real path rules as links checked on every read, size cap, optional section by heading text, render with lib/markdown.mjs, cache by mtime and size so a changed file shows on the next poll; also listed as a file so the panel links to the full page on the files origin.
4. Page: generic rendering of groups (rows are task buttons that open the CREW-13 modal) and html (server rendered markdown in a scroll box with maxHeight); keyed panel rendering so a poll does not reset scroll.
5. Tests: unit tests for both modules (validation, filters, grouping, limit, path rules, section, refresh) and a server test with a backlog stub list; README for both types.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on feat/panels, commit daec492.
- lib/crew.mjs keeps labels, priority and ordinal per task and exposes getTasks(); lib/widgets.mjs passes a context to create, server gives backlog: { enabled(), tasks() }.
- widgets/backlog.mjs: validate(options), matches, overview (group, sort by priority then ordinal then id, limit with a more line). Decisions: labels filter matches any label; assignee with or without @; status groups follow the filter order, else To Do, In Progress, Done, then others by name; groupBy label with a labels filter only shows the asked labels. Updates live: the view reads the current task list on each page poll (6 s).
- widgets/markdown.mjs: validate (file required, no .. or leading /, id, title, section, maxHeight 100..2000 px), projectFile real path rule on every read, 512 kB cap, section by heading text up to the next heading of the same or higher level (fences ignored), cache by mtime and size, rendered with lib/markdown.mjs. Also lists the file so the panel links to the whole file on the files origin.
- lib/project-file.mjs: shared real path rule, links widget now uses it.
- Page: generic rendering of groups (task rows are data-task buttons, so the CREW-13 modal opens) and html in a scroll box; widget panels are now keyed so a poll keeps scroll; markdown headings inside panels and the modal are no longer uppercase heading font.
- Both modules export validate(options) for the CLI in CREW-16; links and dev-server do not have one yet.
- README (contract and both types) and PLAN file map updated.
Validation: npm test 136/136, npm run check ok. New test/panel-widgets.test.mjs (validation, filters, grouping, limit, live task list, Backlog off, section, escaping, refresh on change, symlink out, missing, big file, swap to symlink). Server test with a backlog stub task list: grouped rows, markdown section escaped, whole file link served, ../ refused, file change shows up. Manual: own instance on 5277 against a temp copy (PLAN.md and backlog/), headless Chrome: three panels render, scroll survives a poll (same element), clicking a row opens the task modal.

crew-orch 2026-11-13: rebased onto main, npm test 136 pass, checked that markdown rendering escapes HTML, scripts and javascript links and that paths go through lib/project-file.mjs; fast-forward merged and pushed. Restarted 5192 and 5190, existing widgets still load.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added backlog and markdown widget types with options validation, live updates and safe rendering, documented in README. Verified with npm test (136 pass), npm run check and a scripted headless Chrome check on an own instance (port 5277).
<!-- SECTION:FINAL_SUMMARY:END -->
