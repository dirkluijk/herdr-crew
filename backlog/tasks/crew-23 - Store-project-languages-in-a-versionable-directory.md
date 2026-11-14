---
id: CREW-23
title: Store project languages in a versionable directory
status: To Do
assignee:
  - '@m5-panels'
created_date: '2026-11-14 12:57'
updated_date: '2026-11-14 12:58'
labels:
  - i18n
dependencies:
  - CREW-28
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Project languages added with crew.mjs locale add (CREW-20) are stored in .herdr-crew/locales, which is gitignored state, so colleagues do not get them. User decision 2026-11-14: store them in a versionable project directory .herdr-crew-locales/ (optionally configurable with localesDir in .herdr-crew.json). Keep reading .herdr-crew/locales as a fallback for languages added before this change, and let locale add write to the new directory. Update the skill Languages section and README.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 locale add writes to .herdr-crew-locales/ (or localesDir) and the dashboard reads it
- [ ] #2 Languages in the old .herdr-crew/locales still load
- [ ] #3 Skill and README describe the new location; npm test and npm run check pass
<!-- AC:END -->
