---
id: CREW-6
title: Add a remote for the herdr-crew repo
status: To Do
assignee: []
created_date: '2026-11-13 10:14'
updated_date: '2026-11-13 11:35'
labels:
  - repo
dependencies: []
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
~/workspace/herdr-crew is a local git repo without a remote (main branch, commits since 2026-11-13). Decide where it lives (for example GitHub or Azure DevOps, private or public) with the user, add the remote, push, and consider backlog config set remoteOperations true and checkActiveBranches true afterwards (both were turned off because there is no remote). Check the history for secrets before a public push (git grep for keys, base URLs of the Foundry resource; none were found on 2026-11-13).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Remote chosen by the user, added and pushed
- [ ] #2 Backlog remote settings match the new setup
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-13: user chose GitHub, private, on account dirkluijk.
<!-- SECTION:NOTES:END -->
