---
id: CREW-4
title: Manual mouse drag test of card reordering
status: Done
assignee:
  - '@crew-orch'
created_date: '2026-11-13 10:14'
updated_date: '2026-11-13 12:21'
labels:
  - ui
dependencies: []
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cards can be reordered and pinned (public/index.html: tool row per card with drag handle, up, down, pin; layout in localStorage under herdr-crew:layout:<id or project hash>:<port>). Verified on 2026-11-13 with synthetic DragEvents through the Chrome DevTools protocol: drag, pin, reload, keyboard move, unpin by dragging back, reset. A real mouse drag in a normal browser window was not tested: drag image, drop markers (blue bar before or after a card), the dashed pinned drop zone when nothing is pinned, and the 4 second snapshot updates being held back while dragging.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Real mouse drags in Chrome (and Safari if used) reorder cards, pin by dropping on the pinned area and unpin by dropping back
- [x] #2 No card jumps or flickers when a snapshot arrives during a drag
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-13: user tests real mouse drags himself on the herdr-crew dashboard at http://localhost:5192.

crew-orch 2026-11-13: user tested real mouse drags on the herdr-crew dashboard (5192) after CREW-11 was merged and confirmed that reorder, pin, unpin and snapshot updates during a drag work.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Real mouse drags confirmed by the user on 5192 with the CREW-11 build: reorder, pin by dropping on the pinned area, unpin by dragging back, no jumps during snapshots.
<!-- SECTION:FINAL_SUMMARY:END -->
