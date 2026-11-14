---
id: CREW-28
title: Remove the Answer dialog for now
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-14 12:58'
updated_date: '2026-11-14 13:08'
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
- [x] #1 No Answer dialog, keys or type action, or send-keys and send-text calls remain
- [x] #2 Blocked cards show a hint to use Go to
- [x] #3 README, locales and tests are updated; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Remove the Answer button and modal (openAnswer, KEY_LABELS, .keys and .seq CSS), the keys and type actions with DIALOG_KEYS, send-keys and send-text in the command map, GET /api/agents/<id>/screen and the read entry (only the Answer dialog used them), the unused get entry and currentStatus, the locale strings; add ui.blockedHint and point ui.chatBlocked to Go to; update tests, README and PLAN decisions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Commit 2bb77bd on feat/panels. Removed: Answer button and dialog, keys and type actions, DIALOG_KEYS, HERDR map entries read, keys (agent send-keys), type (pane send-text) and the now unused get, currentStatus, GET /api/agents/<id>/screen, locale keys ui.answer, ui.dialogTitle, ui.dialogHint, ui.ownAnswer, ui.keysLbl, ui.textLbl. Kept: the screen read in lib/crew.mjs for the 🖥 fallback bubble and the blocked status. New: ui.blockedHint on blocked cards (⚠ waits on a question or permission dialog, use Go to and answer it in Herdr), Go to highlighted (urgent) for blocked agents, ui.chatBlocked now points to Go to. POST keys, type, screen and other unknown agent actions answer 404 through the allowlist. Decision recorded in PLAN (2026-11-14): the dashboard no longer types into agents except plain chat prompts and the confirmed onboarding, panel and language requests; a better Answer dialog can return as a new task. README Safeguards sentence replaced (small edit). Validation: npm test 175/175, npm run check ok, page script syntax ok; server test with a blocked stub agent: keys, type, screen, zoom 404, GET screen not 200, no send-keys, send-text or pane zoom calls, page without Answer code, actions.mjs without send-keys or send-text. Manual: stub instance on 5277 with a blocked agent: hint shown, Ga naar highlighted, no Answer button, chat placeholder points to Ga naar.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the Answer dialog, the keys and type actions and their Herdr commands; blocked cards now point to Go to. Verified with npm test (175 pass), npm run check and a stub instance check.
<!-- SECTION:FINAL_SUMMARY:END -->
