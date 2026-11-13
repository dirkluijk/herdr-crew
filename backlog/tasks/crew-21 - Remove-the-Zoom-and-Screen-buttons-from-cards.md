---
id: CREW-21
title: Remove the Zoom and Screen buttons from cards
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-13 13:25'
updated_date: '2026-11-13 13:56'
labels:
  - ui
dependencies:
  - CREW-18
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-11-13. Zoom calls herdr pane zoom --toggle, which only has an effect when the agent tab has more than one pane; milestone agents have one pane per tab, so the button does nothing for the user and is not relevant. Screen expands a plain text pre with the visible screen inside the card, which the user finds not ergonomic; Go to opens the real Herdr screen. Remove: the Zoom and Screen buttons on cards, the expanding screen pre with its state (openScreens, screens) and the screen grid area in the CSS, the zoom action in lib/actions.mjs and zoom in the HERDR command map, the nl and en strings, and mentions in the footer text and README. Keep: GET /api/agents/<id>/screen, used by the Answer dialog for the last 30 lines of a blocked agent, and the screen fallback bubble (🖥) on cards. Do this after CREW-18 and before CREW-19, so the locale work does not translate removed strings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cards have no Zoom or Screen buttons and no expanding screen view
- [x] #2 The zoom action and herdr pane zoom are gone from lib/actions.mjs
- [x] #3 The Answer dialog still shows the last screen lines of a blocked agent
- [x] #4 README and footer no longer mention Zoom or Screen; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Remove the buttons, the screen pre with openScreens, screens and refreshScreens, the screen grid area and .screen CSS, the zoom action and HERDR zoom entry, the nl and en strings, and the README and PLAN mentions. Keep GET /api/agents/<id>/screen for the Answer dialog and the 🖥 fallback bubble.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Commit 704cce2 on feat/panels. Removed from public/index.html: Zoom and Screen buttons, the expanding pre, openScreens, screens, refreshScreens and its 4 s interval, the screen grid area (lead card layouts), .screen and .actions button.on CSS, zoom and screen strings in nl and en; the focus click handler now only does focus. lib/actions.mjs: zoom removed from the HERDR map and the zoom action; added an allowlist of POST agent actions (focus, prompt, onboard, register, close, keys, type) so unknown actions such as zoom answer 404 instead of falling through to the blocked dialog check. Kept GET /api/agents/<id>/screen (Answer dialog) and the 🖥 screen fallback bubble; the footer only mentions reading screens and the 🖥 fallback, which are still true, so it stays. README Safeguards and PLAN file map updated. Validation: npm test 160/160, npm run check ok; new server test: POST zoom, screen and nope give 404, no herdr pane zoom call, GET screen still works, the page has no zoom or screen buttons. Manual: own instance on 5277 with stub herdr and a blocked stub agent: card buttons are only Ga naar, Informeer and Beantwoord dialoog; the Answer dialog shows the stub screen lines.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the Zoom and Screen buttons, the expanding screen view and the zoom action; the Answer dialog still reads the last screen lines. Verified with npm test (160 pass), npm run check and a headless Chrome check with stub herdr.
<!-- SECTION:FINAL_SUMMARY:END -->
