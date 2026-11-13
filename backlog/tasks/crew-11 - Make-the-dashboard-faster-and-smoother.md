---
id: CREW-11
title: Make the dashboard faster and smoother
status: Done
assignee:
  - '@m4-snappy'
created_date: '2026-11-13 11:39'
updated_date: '2026-11-13 12:18'
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
- [x] #1 Status changes appear in the browser within about 1 s, and right after a dashboard action
- [x] #2 Unchanged snapshots are not re-sent and unchanged cards are not re-rendered (no flicker, selection and hover survive)
- [x] #3 Backlog changes appear within a few seconds
- [x] #4 Drag and pin, chat drafts and focus still work
- [x] #5 npm test and npm run check pass, with tests for the new change detection
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lib/live.mjs (new, zero deps): snapshotKey (hash without updatedAt), a hub for SSE clients that only sends changed snapshots plus a small alive event every 5 s, a poll scheduler (1 s with SSE clients, 4 s without, kick() for an immediate coalesced poll) and a parser for the concatenated JSON of backlog task list --json --watch.
2. server.mjs: use the hub and scheduler, kick a poll after every handled POST action and when a browser connects, kill the watch child on exit.
3. crew.mjs: Backlog.md via --watch with fallback to 15 s polling when the watch is unsupported or keeps dying; write memory.json only when it changed.
4. index.html: keyed per-card DOM reconcile (rebuild only cards whose data or local state changed, reuse avatar img, move nodes for order), patch counts/banner/updated only on change, live ago labels via data-ago, handle alive events, optimistic chat bubble with rollback on error, clear .dragging after drag.
5. Tests for snapshotKey, hub dedup and heartbeat, scheduler and JSON stream parser; an HTTP test that an unchanged snapshot is not re-sent and a POST action triggers a poll. Manual check on own port.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in commit 3a836b7 on feat/snappy-dashboard (worktree herdr-crew-snappy). New lib/live.mjs: snapshotKey (sha1 without updatedAt), SSE hub (snapshot only on change, event alive every 5 s), poll scheduler (1 s with a browser connected, 4 s without, kick coalesces), JSON stream reader for backlog --watch. server.mjs kicks a poll after every handled POST and on every /events connect. crew.mjs follows backlog task list --json --watch; a watch that ends within 10 s falls back to 15 s polling (seen with the test stub), a later end restarts after 5 s; the child is killed on exit, SIGINT and SIGTERM. memory.json is written only when it changed. index.html: keyed cards (key = card JSON + pin + open screen + chat note), avatar img reused on rebuild, nodes only moved when their place changed, counts/banner/updated only patched on change, data-ago labels tick every 15 s, optimistic chat bubble with rollback of draft and error note, .dragging cleared on dragend. PLAN.md updated.

Verification: npm test 78/78 pass incl. test/live.test.mjs (key, hub dedup and heartbeat, scheduler, JSON stream) and two HTTP tests (unchanged snapshot not re-sent over 2.5 s; prompt action shows up in a new SSE snapshot). npm run check passes. Own instance on 5197 against the worktree project with headless Chrome via CDP, no prompts sent: over 8 s 0 cards rebuilt, 5 of 5 card nodes kept, only 2 DOM mutations (updated label), not stale; a draft with focus and selection 2-7 survived and stayed after pin and unpin; pin button keeps focus; synthetic drag to pinned, reorder within pinned before and after, and unpin by dragging back all work with no leftover drop or dragging classes. Backlog: temp project on 5199, task status edit visible over SSE 335 ms after backlog task edit returned. Fallback: with the stub backlog the server logs the 15 s polling message. Watch children gone after stopping the instances. Not tested: a real mouse drag in a visible browser (see CREW-4).

crew-orch 2026-11-13: rebased onto main (b6ba607) without conflicts, npm test 101 pass, npm run check ok, fast-forward merged into main as 29fa457. Dashboard 5192 restarted on the new code; one backlog --watch child runs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The dashboard now polls Herdr every second while a browser is open and right after every action, follows Backlog.md through --watch, sends a snapshot only when it changed and rebuilds only changed cards. Verified with npm test (78 pass, new unit and HTTP tests), npm run check, and CDP checks on an own instance (no rebuilds of unchanged cards, drafts, focus, pin and drag intact, backlog change visible in about 0.3 s).
<!-- SECTION:FINAL_SUMMARY:END -->
