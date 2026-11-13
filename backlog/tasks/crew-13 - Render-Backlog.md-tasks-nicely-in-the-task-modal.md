---
id: CREW-13
title: Render Backlog.md tasks nicely in the task modal
status: To Do
assignee:
  - '@m2-tests'
created_date: '2026-11-13 12:16'
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
- [ ] #1 The modal shows sections, checkboxes and a status pill from the JSON output, styled with the theme
- [ ] #2 Markdown in task fields is rendered safely through lib/markdown.mjs
- [ ] #3 Dependency ids open the referenced task in the modal
- [ ] #4 Without a known schemaVersion the modal falls back to plain text
- [ ] #5 Tests cover the JSON to view mapping and the fallback; npm test and npm run check pass
<!-- AC:END -->
