---
id: CREW-5
title: Deck choices start empty on the links widget files origin
status: Done
assignee:
  - '@m2-tests'
created_date: '2026-11-13 10:14'
updated_date: '2026-11-13 11:37'
labels:
  - widgets
dependencies: []
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The links widget (widgets/links.mjs) serves configured local files read only on a separate origin, http://localhost:<port + 1>/files/<widget>/<key> (5191 for other-project), so pages with scripts cannot call the dashboard API. Pages that keep state in localStorage, like the cloud deck in other-project (meetings/deck/deck.html), start empty there: localStorage is per origin, so choices made earlier via file:// do not carry over. The widget note says so. Choices made on 5191 do stay, as long as the files port stays the same. Options: accept and document only; a generic export and import helper on the files origin (paste JSON into a localStorage key, never on the dashboard origin); or a per-link seed option. Served files must not be changed by the dashboard.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision is recorded, and if a helper is built it only writes to the files origin and is covered by the README
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a note to the README links widget section: files are served on their own origin (port + 1), so localStorage there is separate from file:// and from the dashboard; state saved via file:// does not carry over, state saved on the files origin stays as long as the files port stays the same. No helper, no seed option (user decision).
2. Commit only that hunk with git add -p.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-13: user decision: document only, no helper and no seed option. Add a clear note to the README links widget section (the widget note already says it).

m2-tests 2026-11-13: decision recorded (user, via crew-orch): document only, no export/import helper and no seed option. Added a paragraph to the README links widget section: localStorage is per origin (scheme, host, port), so file:// state does not carry over to the files origin and the other way round; state on the files origin survives dashboard restarts as long as the files port stays the same and links are opened via localhost (127.0.0.1 is another origin); the files port follows the dashboard port unless pinned with filesPort; herdr-crew never copies, imports or seeds localStorage and never changes served files. Nothing else changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decided to document only (user decision). The README links widget section now explains why pages with localStorage state start empty on the files origin, when that state persists (same files port, opened via localhost) and how to keep the port stable with filesPort. No helper or seed option was built; served files are never changed.
<!-- SECTION:FINAL_SUMMARY:END -->
