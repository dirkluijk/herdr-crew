---
id: CREW-22
title: Close only agents that belong to this project
status: To Do
assignee:
  - '@m5-panels'
created_date: '2026-11-14 12:57'
labels:
  - actions
  - security
dependencies: []
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the CREW-20 end to end check: a test dashboard for another project offered Close for crew-orch, because crew-orch was a live unregistered agent in the same Herdr workspace (workspace from the inherited HERDR_WORKSPACE_ID). The script cancelled the dialog, nothing happened. User decision 2026-11-14: Close is only allowed when the agent cwd (from herdr agent get or list, cwd or foreground_cwd) is the project, inside it, or a git worktree of it: the same allowedCwd rule as Reopen (lib/agents.mjs). Hide the Close button for other agents (snapshot flag such as canClose) and refuse on the server too. Unregistered agents of the own project stay closable. Also consider showing agents from other projects in the workspace with a small badge (other project) and no actions except Go to; document the choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Close is refused on the server and hidden in the page for agents whose cwd is not the project, inside it, or a git worktree of it
- [ ] #2 Unregistered agents of the own project can still be closed
- [ ] #3 Tests cover agents from another project in the same workspace; npm test and npm run check pass
<!-- AC:END -->
