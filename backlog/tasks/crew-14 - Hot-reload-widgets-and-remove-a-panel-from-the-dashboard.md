---
id: CREW-14
title: Hot reload widgets and remove a panel from the dashboard
status: To Do
assignee: []
created_date: '2026-11-13 12:36'
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
