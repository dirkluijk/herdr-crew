---
id: CREW-28
title: Remove the Answer dialog for now
status: To Do
assignee:
  - '@m5-panels'
created_date: '2026-11-14 12:58'
labels:
  - ui
  - actions
dependencies:
  - CREW-22
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-11-14: the Answer dialog for blocked agents is not production ready (poor UX); remove it and maybe reintroduce it later. Remove: the Answer dialog button and modal in public/index.html, the keys and type actions in lib/actions.mjs (herdr agent send-keys, herdr pane send-text) and their command map entries, GET /api/agents/<id>/screen if nothing else uses it, the locale strings, README and footer mentions, and the related tests. Keep: blocked status on cards with a clear hint to use Go to (new locale key), and the screen fallback bubble from the poll. Record in the task and PLAN decisions that the dashboard no longer types into agents except plain chat prompts, so it can be reintroduced later as a new task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No Answer dialog, keys or type action, or send-keys and send-text calls remain
- [ ] #2 Blocked cards show a hint to use Go to
- [ ] #3 README, locales and tests are updated; npm test and npm run check pass
<!-- AC:END -->
