---
id: CREW-12
title: init does not detect the terminal app for Go to
status: In Progress
assignee:
  - '@m2-tests'
created_date: '2026-11-13 11:39'
updated_date: '2026-11-13 11:59'
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
- [x] #1 init fills terminalApp when the outer terminal can be detected
- [ ] #2 Without terminalApp the dashboard shows a hint after Go to
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lib/init.mjs: detectTerminalApp(env, platform), used by buildConfig: HERDR_CREW_TERMINAL first, then on macOS __CFBundleIdentifier, terminal specific variables, TERM_PROGRAM.
2. lib/actions.mjs: log Go to in actions.log and return terminalApp and raised in the focus response, so the dashboard can show a hint later.
3. Tests with a stub open on PATH; README rows for terminalApp and HERDR_CREW_TERMINAL.
4. Dashboard hint (AC2): proposal in notes only, index.html is being reworked by m4-snappy (CREW-11).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-13: assigned to m2-tests after CREW-2. Do the init detection and the focus log now. The dashboard hint touches public/index.html, which m4-snappy is reworking in a worktree: do not edit index.html; record the proposed hint in the notes and report, it will be done after CREW-11 is merged.

m2-tests 2026-11-13:
- init detection (AC1): new detectTerminalApp(env, platform) in lib/init.mjs, used by buildConfig. Order: HERDR_CREW_TERMINAL (any platform), then only on darwin: __CFBundleIdentifier mapped to an app name (Alacritty, Terminal, iTerm, kitty, WezTerm, Ghostty, Warp, Hyper, Rio), then variables the terminal leaves behind (ALACRITTY_SOCKET, ALACRITTY_WINDOW_ID, KITTY_WINDOW_ID, WEZTERM_PANE, GHOSTTY_RESOURCES_DIR, ITERM_SESSION_ID), then TERM_PROGRAM (Apple_Terminal, iTerm.app, WezTerm, ghostty, WarpTerminal, Hyper, kitty, alacritty). herdr, tmux, vscode and unknown bundle ids give null. Herdr runs as a daemon, so the process tree does not reach the terminal, but agents inherit the env of the terminal that started Herdr. Checked here: gives Alacritty, also without __CFBundleIdentifier (via ALACRITTY_SOCKET). Existing configs are not changed; init only runs on a new config.
- Focus logging: Go to now writes a focus line to .herdr-crew/actions.log with {ok, terminalApp, raised}. The response is {ok, terminalApp, raised}: raised is true or false after open -a on macOS, and null when there is no terminalApp (or not on macOS). Additive, the current page only reads ok.
- Tests: test/init.test.mjs (detection cases), test/server.test.mjs (focus with terminalApp FakeTerm and a stub open in test/fixtures/bin, so no real app is raised; then config without terminalApp after hot reload gives terminalApp null). npm test 89 pass, 0 fail; npm run check passes.
- README: terminalApp row explains detection, HERDR_CREW_TERMINAL row says it wins over detection.

Proposed dashboard hint (AC2, for after CREW-11 is merged, public/index.html not touched):
After a Go to click, when the response has terminalApp null, show a short toast or a line under the card buttons for about 6 seconds. Text nl: 'Pane staat vooraan in Herdr, maar de terminal komt niet naar voren: zet terminalApp in .herdr-crew.json (bijv. Alacritty).' en: 'Focused the pane in Herdr, but the terminal stays behind: set terminalApp in .herdr-crew.json (for example Alacritty).' When raised is false: nl 'terminalApp <naam> kon niet geopend worden', en 'Could not open terminalApp <name>'. Show it at most once per page load, or only on non-macOS skip it entirely (raised null and terminalApp set means not macOS: no hint). Optionally publicConfig could expose terminalApp so the hint can appear before the first click; not done, server.mjs was being edited by others.
<!-- SECTION:NOTES:END -->
