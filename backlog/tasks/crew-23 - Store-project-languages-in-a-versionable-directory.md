---
id: CREW-23
title: Store project languages in a versionable directory
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-14 12:57'
updated_date: '2026-11-14 13:14'
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
- [x] #1 locale add writes to .herdr-crew-locales/ (or localesDir) and the dashboard reads it
- [x] #2 Languages in the old .herdr-crew/locales still load
- [x] #3 Skill and README describe the new location; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lib/languages.mjs: DEFAULT_LOCALES_DIR .herdr-crew-locales, optional localesDir (path inside the project, same rule as widget paths, else ignored), legacyLocaleDir .herdr-crew/locales, projectLocaleDirs in order of precedence; addLocale takes the target dir.
2. server.mjs: serve and the locale CLI register both dirs; locale add writes to the first; locale list shows the source folder; warning for an ignored localesDir.
3. Tests, README (Languages and config table), skill Languages section, PLAN.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Commit a45ef78 on feat/panels. Decisions: default folder <project>/.herdr-crew-locales next to .herdr-crew.json (versionable); localesDir must be a relative path inside the project (no .., no leading / or ~), otherwise it is ignored with a warning and the default is used; a changed localesDir needs a dashboard restart (dirs are registered at start), adding or updating a language does not. The old .herdr-crew/locales is read as a fallback; when both have the same code the new folder wins. The draft file stays in .herdr-crew/locale-draft.json (state, not meant to be committed). Skill tells the orchestrator to mention the new file to the user since it is meant to be committed. Validation: npm test 188/188, npm run check ok. test/languages.test.mjs: default and configured dir, bad localesDir values, legacy de still loads, fr in the new dir, newer de in the new dir wins. server.test.mjs: locale add writes to .herdr-crew-locales, a file in the old folder shows in locale list and /api/config, localesDir i18n/dashboard is used by the CLI, ../outside is ignored with a warning. Manual: own instance on 5277 against a temp project with de added through the CLI and fr in the old folder: locale list shows both folders and /api/config offers de and fr as project languages.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
locale add now stores project languages in the versionable .herdr-crew-locales/ (or localesDir), and languages in the old .herdr-crew/locales still load. Verified with npm test (188 pass), npm run check and a check with an own instance.
<!-- SECTION:FINAL_SUMMARY:END -->
