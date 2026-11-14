---
id: CREW-29
title: 'Incident: /reload interrupted all OpenCode sessions on the machine'
status: Done
assignee:
  - '@crew-orch'
created_date: '2026-11-14 13:36'
updated_date: '2026-11-14 13:36'
labels:
  - incident
dependencies: []
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-14 around 13:15 UTC (14:15 CET) m6-release used /reload in a throwaway OpenCode session during the CREW-26 end to end check. /reload restarts the OpenCode service that all sessions on the machine share. Five agents of the other-project crew (orchestrator, m1-reconcile, m3-basics, m3-deck, m2-registry) dropped to an empty OpenCode screen; their sessions stayed on disk. Restored with the user's go: in each pane ctrl+c on the empty input box, then herdr agent start <name> --kind opencode --pane <pane> -- --session <ses_id> with the session id from herdr agent list (a second try was needed for two agents because Herdr still held the name for a moment). All titles and the 5190 dashboard were back afterwards. Fix: both skills now forbid /reload (commit 101640f) and the herdr-orchestrator skill describes the restore steps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Affected agents restored with their own sessions
- [x] #2 Skills forbid /reload and describe the restore steps
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Five other-project agents restored in their own panes with their own sessions; /reload is now forbidden in both skills.
<!-- SECTION:FINAL_SUMMARY:END -->
