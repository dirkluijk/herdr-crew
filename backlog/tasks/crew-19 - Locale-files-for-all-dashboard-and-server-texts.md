---
id: CREW-19
title: Locale files for all dashboard and server texts
status: To Do
assignee: []
created_date: '2026-11-13 13:22'
labels:
  - i18n
  - ui
dependencies:
  - CREW-18
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-11-13 (grilling): hybrid i18n, option C. Today public/index.html has two inline string blocks (nl from about line 264, en from about line 300, many are functions with parameters) and lib/*.mjs, widgets/*.mjs and server.mjs have about 22 places with nl/en branches (onboarding templates in lib/config.mjs, widget confirm texts, panel request text in lib/panels.mjs, errors). Build: 1. One locale file per language, locales/nl.json and locales/en.json, same keys, placeholders as {name}; both the page and the server read them (serve the active locale to the page through /api/config or a small /api/locale endpoint, no extra static file access). 2. language in .herdr-crew.json selects the file; unknown language or missing key falls back to en; bubbleLanguage stays separate. 3. A language picker in the UI that writes language through a confirmed, logged action (or document why it stays config only). 4. A check (function plus test) that every locale has the same keys and the same placeholders as en.json and no empty strings. 5. Themes may only override flavour texts: title, tagline, status labels, section headings and optionally button labels; confirmations, errors, guard and onboarding texts always come from the locale file. Enforce this in validateTheme. 6. If a theme prompt asks for a UI language (for example UI in english), set language to that locale when it exists, otherwise tell the user it can be added (CREW-20). Keep .herdr-crew.json backward compatible: existing language nl or en keeps working, existing themes keep their labels. Shipped languages: nl and en only. Start after CREW-18 is merged; it touches most texts in index.html and server code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All UI and server texts come from locales/nl.json and locales/en.json; no inline nl or en text blocks remain
- [ ] #2 Unknown language or missing keys fall back to English
- [ ] #3 A test checks that all locales have the same keys and placeholders
- [ ] #4 Themes can only override flavour texts; confirmations, errors and guard texts are never taken from a theme
- [ ] #5 Existing configs (nl, en, themes) look the same as before; npm test and npm run check pass
<!-- AC:END -->
