---
id: CREW-5
title: Deck choices start empty on the links widget files origin
status: To Do
assignee: []
created_date: '2026-11-13 10:14'
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
- [ ] #1 A decision is recorded, and if a helper is built it only writes to the files origin and is covered by the README
<!-- AC:END -->
