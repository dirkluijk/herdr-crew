---
id: CREW-14
title: Hot reload widgets and remove a panel from the dashboard
status: In Progress
assignee:
  - '@m5-panels'
created_date: '2026-11-13 12:36'
updated_date: '2026-11-13 12:39'
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
- [ ] #1 Adding, changing or removing a widget entry in .herdr-crew.json shows up in the browser without restart
- [ ] #2 A panel can be removed from the dashboard after confirmation, logged in actions.log
- [ ] #3 The files origin serves files of newly added links widgets and stops serving removed ones
- [ ] #4 Tests cover reload and removal; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. New lib/widgets.mjs: createWidgetSet that loads instances keyed by the JSON of the entry plus language, sync(entries) keeps unchanged instances, creates new ones, calls dispose() on removed ones (dev-server processes untouched), shows a broken entry as an error panel, refuses duplicate ids, serializes syncs. removeEntry(file, entryKey) removes one entry from .herdr-crew.json.
2. server.mjs: use the set at start and in reloadConfig; files origin looks up files live from the set and starts lazily when the first file appears; publicConfig and /api/widgets read the current list.
3. POST /api/widgets/<id>/remove (reserved action name) with Host, Origin, X-Crew, confirmed, actions.log; GET returns the confirm text.
4. public/index.html: remove button per panel through the existing confirm flow; poll /api/widgets always and set the heading from the views so new panels show up.
5. Tests: unit tests for the set (keep, add, change, remove, dispose, duplicate, broken) and server tests for hot reload, files origin and remove. README and skill line about restart.
<!-- SECTION:PLAN:END -->
