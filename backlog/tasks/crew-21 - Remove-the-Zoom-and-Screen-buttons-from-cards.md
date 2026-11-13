---
id: CREW-21
title: Remove the Zoom and Screen buttons from cards
status: To Do
assignee:
  - '@m5-panels'
created_date: '2026-11-13 13:25'
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
- [ ] #1 Cards have no Zoom or Screen buttons and no expanding screen view
- [ ] #2 The zoom action and herdr pane zoom are gone from lib/actions.mjs
- [ ] #3 The Answer dialog still shows the last screen lines of a blocked agent
- [ ] #4 README and footer no longer mention Zoom or Screen; npm test and npm run check pass
<!-- AC:END -->
