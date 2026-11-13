---
id: CREW-14
title: Hot reload widgets and remove a panel from the dashboard
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-13 12:36'
updated_date: '2026-11-13 12:47'
labels:
  - widgets
  - ui
dependencies: []
priority: medium
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Widgets are created once at server start (server.mjs reads cfg.widgets; README says restart for new widgets). Personas already hot reload when .herdr-crew.json changes (reloadConfig in server.mjs). Make widgets hot reload too: when the widgets array changes, create new widget instances, dispose removed ones (stop timers, keep dev-server processes untouched unless their own Stop action is used), keep unchanged ones, and refresh the files origin map of the links widget. Add a remove button on each panel in public/index.html that, after a confirmation, removes that widget entry from .herdr-crew.json through a new POST action with the existing guards (Host, Origin, X-Crew, confirmed, actions.log). Keep .herdr-crew.json backward compatible. Context: user decision 2026-11-13 for an Add panel feature (see CREW-16): panels are only built-in declarative widget types, added by the orchestrator, and must appear without restart.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Adding, changing or removing a widget entry in .herdr-crew.json shows up in the browser without restart
- [x] #2 A panel can be removed from the dashboard after confirmation, logged in actions.log
- [x] #3 The files origin serves files of newly added links widgets and stops serving removed ones
- [x] #4 Tests cover reload and removal; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. New lib/widgets.mjs: createWidgetSet that loads instances keyed by the JSON of the entry plus language, sync(entries) keeps unchanged instances, creates new ones, calls dispose() on removed ones (dev-server processes untouched), shows a broken entry as an error panel, refuses duplicate ids, serializes syncs. removeEntry(file, entryKey) removes one entry from .herdr-crew.json.
2. server.mjs: use the set at start and in reloadConfig; files origin looks up files live from the set and starts lazily when the first file appears; publicConfig and /api/widgets read the current list.
3. POST /api/widgets/<id>/remove (reserved action name) with Host, Origin, X-Crew, confirmed, actions.log; GET returns the confirm text.
4. public/index.html: remove button per panel through the existing confirm flow; poll /api/widgets always and set the heading from the views so new panels show up.
5. Tests: unit tests for the set (keep, add, change, remove, dispose, duplicate, broken) and server tests for hot reload, files origin and remove. README and skill line about restart.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch feat/panels in worktree ~/workspace/herdr-crew-panels, commit 1c7b724.
- lib/widgets.mjs: createWidgetSet keys instances by language plus entry JSON; sync serialized; dispose() on removed or changed entries (optional hook for widgets, none of the current ones need it; dev-server processes stay up). Broken entries become an error panel (id from options.id or widget-N) so they can be removed from the page; duplicate ids are skipped with a log line. removeEntry removes exactly the matching entry from the raw file and keeps other keys.
- server.mjs: reloadConfig also copies widgets and syncs; files origin looks files up live and starts lazily with the first listed file (stays up after that; listen error is logged, not fatal). POST /api/widgets/<id>/remove (GET gives the confirm text), name remove is reserved. Also: actions only from own properties (constructor etc. gave 500 before).
- public/index.html: always polls /api/widgets (6 s) and sets the heading from the views; ✕ button per panel (visible on hover/focus) through the existing confirm flow with a Verwijderen/Remove button.
- README widgets section and the skill restart line updated.
Validation: npm test 121/121 pass, npm run check ok. New test/widgets.test.mjs (keep/replace/dispose, language, duplicate, broken, files, serial sync, removeEntry). server.test.mjs: hot add, change, remove with files origin follow-up; remove guards 403/400/421, removal and actions.log line. Manual: own instance on 5277/5278 against a temp copy of the project; headless Chrome via CDP: panel appeared ~10 s after writing the entry without reload, ✕ then Verwijderen removed it from page and file, actions.log has the entry; starting with zero widgets and adding one started the files origin (404 before, 200 after). Pick up time: up to 4 s server poll without a browser (1 s with one) plus up to 6 s page poll.

crew-orch 2026-11-13: rebased onto main, npm test 125 pass, fast-forward merged as 9af846b and pushed. Restarted 5192 and 5190; the other-project widgets deck and docs-pushed load and a files origin link on 5191 answers 200.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Widgets now hot reload from .herdr-crew.json (new, changed, removed entries, files origin follows) and each panel can be removed from the dashboard after confirmation, logged in actions.log. Verified with npm test (121 pass), npm run check, and a scripted headless Chrome check on an own instance (port 5277).
<!-- SECTION:FINAL_SUMMARY:END -->
