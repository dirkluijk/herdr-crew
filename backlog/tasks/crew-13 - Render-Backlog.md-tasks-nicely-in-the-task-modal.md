---
id: CREW-13
title: Render Backlog.md tasks nicely in the task modal
status: Done
assignee:
  - '@m2-tests'
created_date: '2026-11-13 12:16'
updated_date: '2026-11-13 12:26'
labels:
  - ui
dependencies:
  - CREW-11
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today the task modal in public/index.html shows the plain text of backlog task view <id> --plain (GET /api/tasks/:id in lib/actions.mjs). Render the task properly instead, from backlog task view <id> --json (schemaVersion 1, documented as stable; Backlog.md 1.53.0). Fields to use: id, title, status, priority, labels, assignees, description, acceptanceCriteria (index, text, checked), definitionOfDone, implementationPlan, implementationNotes, finalSummary, dependencies. Render markdown fields with lib/markdown.mjs (no scripts, safe link schemes) on the server or an equivalent safe path; show acceptance criteria as read only checkboxes, a status pill in theme colours, sections only when not empty, and dependency task ids as links that open that task in the same modal. Keep it read only: no editing, no extra server. Check schemaVersion and fall back to the current plain text when it is missing or unknown, so older Backlog.md versions keep working. Keep the TASK_ID check and the GET only rule. Decision 2026-11-13: user chose this option (B) over linking to backlog browser; no Open in Backlog.md link in this task. Wait until CREW-11 (feat/snappy-dashboard) is merged, it reworks public/index.html.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The modal shows sections, checkboxes and a status pill from the JSON output, styled with the theme
- [x] #2 Markdown in task fields is rendered safely through lib/markdown.mjs
- [x] #3 Dependency ids open the referenced task in the modal
- [x] #4 Without a known schemaVersion the modal falls back to plain text
- [x] #5 Tests cover the JSON to view mapping and the fallback; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lib/task.mjs: taskView(json) maps backlog task view --json (schemaVersion 1, kind task-view) to a view: plain fields (id, title, status, priority, labels, assignees), dependencies with title and status from dependencyGraph (ids checked against TASK_ID), acceptance criteria and DoD with markdown text, and markdown sections (description, plan, notes, final summary) rendered with lib/markdown.mjs, only when not empty. Unknown or missing schema gives null.
2. lib/actions.mjs GET /api/tasks/:id: try --json, use taskView; fall back to --plain text when the command fails or the view is null. TASK_ID check and GET only stay.
3. public/index.html openTask: render the view (status pill in theme colours, read only checkboxes, sections, dependency buttons that open the task in the same modal), else the old pre.
4. Tests: test/task.test.mjs for the mapping and fallback; HTTP test with a stub backlog for JSON, old version fallback and not found. Check in headless Chrome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
m2-tests 2026-11-13:
- lib/task.mjs: taskView(json) accepts only schemaVersion 1 with kind task-view and a task id matching TASK_ID (moved here from actions.mjs and imported there). Plain fields (title, status, priority, labels, assignees) stay text; dependencies are filtered on TASK_ID and get title and status from dependencyGraph.nodes; acceptance criteria and DoD keep index and checked (checked only when true) with text rendered through renderMarkdown; description, implementationPlan, implementationNotes and finalSummary are rendered through renderMarkdown on the server and left out when empty. Anything else gives null.
- lib/actions.mjs GET /api/tasks/:id: runs backlog task view <id> --json; when that fails, is not JSON or taskView gives null, it runs --plain as before and returns { id, text }. TASK_ID check, cfg.backlog and GET only unchanged; unknown ids 404.
- public/index.html: openTask renders { view } as a header with id and title, a status pill in theme colours (done/complete to --done, progress/doing/review to --working, block to --blocked, to do/open/backlog to --idle, else --unknown), priority, label and assignee pills, Depends on with buttons (data-task, so the existing handler opens them in the same modal) plus their status pill and title, Description, Acceptance criteria and DoD as disabled checkboxes, Plan, Implementation notes, Final summary. Plain fields are escaped on the client; markdown html comes from the server. A sequence number keeps a slow answer from overwriting a newer task or reopening a closed modal. nl and en labels. Read only, no edit actions, no Open in Backlog.md link.
- Tests: test/task.test.mjs (mapping, escaping, empty sections, bad types, unknown schema null); test/server.test.mjs with the stub backlog (JSON view, old version without --json and unknown schema fall back to plain text with ANSI stripped, 404, bad ids and POST 400). npm test 110 pass, npm run check passes.
- Browser check: headless Chrome via CDP against a server on a free port with a copy of this backlog and the real backlog CLI (1.53.0), nl: CREW-13 opens with title, In Progress pill in the working colour, sections Hangt af van, Beschrijving, Acceptatiecriteria, Plan, five disabled checkboxes, no script elements; clicking CREW-11 under Hangt af van opens CREW-11 in the same open modal; CREW-12 shows two checked criteria. Screenshots checked.
- README: backlog row describes the modal and the fallback.
- Known limit, not fixed: renderMarkdown starts every ordered list at 1, so a plan with a later appended item 5 after a blank line shows it as 1. Could add a start attribute in lib/markdown.mjs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The task modal now renders Backlog.md tasks from backlog task view --json (schema version 1): status pill in theme colours, labels and assignees, dependencies that open in the same modal, acceptance criteria and DoD as read only checkboxes, and the markdown sections rendered safely on the server through lib/markdown.mjs. Unknown or missing schemas and older Backlog.md versions fall back to the plain text. Verified with unit and HTTP tests (110 pass, npm run check) and in headless Chrome against the real backlog CLI.
<!-- SECTION:FINAL_SUMMARY:END -->
