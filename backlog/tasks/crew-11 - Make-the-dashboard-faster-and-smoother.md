---
id: CREW-11
title: Make the dashboard faster and smoother
status: To Do
assignee:
  - '@m4-snappy'
created_date: '2026-11-13 11:39'
labels:
  - ui
  - perf
dependencies: []
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants the dashboard to feel faster and smoother (not a responsive layout). Current architecture (2026-11-13): server.mjs runs one loop that reloads the config and calls crew.poll, then waits 4 s (setTimeout after the poll). crew.poll calls herdr agent list, herdr tab list and herdr agent read --source visible --format ansi per live agent (each about 8 ms). Backlog.md is polled every 15 s (backlog task list --json, about 140 ms). The full snapshot is pushed over SSE (/events) after every poll even if nothing changed. Actions in lib/actions.mjs (prompt, focus, keys) do not trigger a new poll, so a card keeps its old status for up to 4 s. In public/index.html render() rebuilds all sections with innerHTML on every snapshot (avatars, cards), which flickers and loses hover, selection and scroll; chat drafts and focus are restored. Ideas: poll every 1 s while at least one SSE client is connected and slower without; poll right after every action; only push a snapshot when it changed (hash); keyed per-card DOM updates that only replace changed cards; Backlog.md via backlog task list --json --watch instead of 15 s polling; optimistic UI for sent chat messages. Constraints: the other-project dashboard (5190) and the herdr-crew dashboard (5192) run from the main checkout, so work in the git worktree you were started in and do not touch the main checkout; never restart those dashboards; for manual checks start your own instance from the worktree on a free port (not 5190 to 5193) with --no-prompt against a temporary or this project; keep .herdr-crew.json backward compatible; keep the STS-47 safeguards; zero dependencies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Status changes appear in the browser within about 1 s, and right after a dashboard action
- [ ] #2 Unchanged snapshots are not re-sent and unchanged cards are not re-rendered (no flicker, selection and hover survive)
- [ ] #3 Backlog changes appear within a few seconds
- [ ] #4 Drag and pin, chat drafts and focus still work
- [ ] #5 npm test and npm run check pass, with tests for the new change detection
<!-- AC:END -->
