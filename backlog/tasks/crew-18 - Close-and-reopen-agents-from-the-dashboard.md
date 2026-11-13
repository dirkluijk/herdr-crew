---
id: CREW-18
title: Close and reopen agents from the dashboard
status: To Do
assignee:
  - '@m5-panels'
created_date: '2026-11-13 13:19'
labels:
  - ui
  - actions
dependencies: []
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request 2026-11-13: close agents from the dashboard and reopen them later. Decisions by the user (grilling 2026-11-13): 1. Close = herdr tab close on the agent tab; OpenCode stops, the session stays on disk; only allowed when the agent pane is the only pane in that tab (never close a tab that also holds the dashboard or other panes). 2. Close only when the agent is idle or done, after a fresh status check, like chat; never for working or blocked agents. 3. No close button for the lead persona (orchestrator). 4. Reopen resumes the same OpenCode session: create a tab in the crew workspace (herdr tab create --workspace <ws> --cwd <cwd> --label <same label> --no-focus), read the pane id from .result.root_pane.pane_id, then herdr agent start <agent> --kind opencode --pane <pane> --timeout 60000 -- --session <ses_id>. No new briefing. Session id: live agents expose agent_session.value in herdr agent list; on close store it in the persona (session field in .herdr-crew.json through registerPersona, which closed cards already use for last words) together with the cwd, so reopen also works after a dashboard restart. Reopen only for personas with a valid ses_ id, only when the agent name is not live elsewhere on the Herdr server (names are global), only for kind opencode. Guards: Host, Origin, X-Crew, confirmed, actions.log, fixed command map through execFile, no user supplied pane ids, cwd only from the stored value and only inside or equal to the project or a known worktree path (decide and document). Keep .herdr-crew.json backward compatible (session and cwd are optional fields).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Live non-lead cards that are idle or done have a Close button; after confirmation the agent tab closes, the session id is stored and the card turns closed
- [ ] #2 Close is refused for working or blocked agents, the lead persona, and tabs with more than one pane
- [ ] #3 Closed cards with a stored OpenCode session have a Reopen button that starts the same session in a new tab with the same label and agent name
- [ ] #4 Reopen is refused when the agent name is live elsewhere or no valid session is stored
- [ ] #5 Every close and reopen is confirmed and logged in actions.log; README documents both
- [ ] #6 Tests cover the guards and the command sequence with stub herdr; npm test and npm run check pass
<!-- AC:END -->
