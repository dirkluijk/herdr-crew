---
id: CREW-12
title: init does not detect the terminal app for Go to
status: To Do
assignee: []
created_date: '2026-11-13 11:39'
labels:
  - bug
dependencies: []
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Go to on a card calls herdr agent focus and then, on macOS, open -a <terminalApp> so the terminal comes to the front. init sets terminalApp only from HERDR_CREW_TERMINAL; inside Herdr TERM_PROGRAM is herdr, so the herdr-crew config got terminalApp null and Go to seemed to do nothing (the browser stayed in front). Fixed by hand on 2026-11-13 by setting terminalApp to Alacritty. Ideas: detect the outer terminal from env (ALACRITTY_SOCKET, __CFBundleIdentifier, TERM_PROGRAM of the parent) in init, show a hint in the dashboard when terminalApp is null, and log focus actions too.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 init fills terminalApp when the outer terminal can be detected
- [ ] #2 Without terminalApp the dashboard shows a hint after Go to
<!-- AC:END -->
