---
id: CREW-19
title: Locale files for all dashboard and server texts
status: Done
assignee:
  - '@m5-panels'
created_date: '2026-11-13 13:22'
updated_date: '2026-11-13 14:10'
labels:
  - i18n
  - ui
dependencies:
  - CREW-21
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-11-13 (grilling): hybrid i18n, option C. Today public/index.html has two inline string blocks (nl from about line 264, en from about line 300, many are functions with parameters) and lib/*.mjs, widgets/*.mjs and server.mjs have about 22 places with nl/en branches (onboarding templates in lib/config.mjs, widget confirm texts, panel request text in lib/panels.mjs, errors). Build: 1. One locale file per language, locales/nl.json and locales/en.json, same keys, placeholders as {name}; both the page and the server read them (serve the active locale to the page through /api/config or a small /api/locale endpoint, no extra static file access). 2. language in .herdr-crew.json selects the file; unknown language or missing key falls back to en; bubbleLanguage stays separate. 3. A language picker in the UI that writes language through a confirmed, logged action (or document why it stays config only). 4. A check (function plus test) that every locale has the same keys and the same placeholders as en.json and no empty strings. 5. Themes may only override flavour texts: title, tagline, status labels, section headings and optionally button labels; confirmations, errors, guard and onboarding texts always come from the locale file. Enforce this in validateTheme. 6. If a theme prompt asks for a UI language (for example UI in english), set language to that locale when it exists, otherwise tell the user it can be added (CREW-20). Keep .herdr-crew.json backward compatible: existing language nl or en keeps working, existing themes keep their labels. Shipped languages: nl and en only. Start after CREW-18 is merged; it touches most texts in index.html and server code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All UI and server texts come from locales/nl.json and locales/en.json; no inline nl or en text blocks remain
- [x] #2 Unknown language or missing keys fall back to English
- [x] #3 A test checks that all locales have the same keys and placeholders
- [x] #4 Themes can only override flavour texts; confirmations, errors and guard texts are never taken from a theme
- [x] #5 Existing configs (nl, en, themes) look the same as before; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. locales/en.json and nl.json, flat keys (ui.*, crew.*, server.*, onboarding.*, panels.*, widget.*, summary.*, meta.*), placeholders {name}; conditional texts split into separate keys; no HTML in values.
2. lib/i18n.mjs: loader for locale directories (shipped dir first, later dirs only add valid languages), fallback to en per key and for unknown codes, checkLocale, format, tr(language).
3. Server and widgets use tr(language); onboarding, panels, crew, summary, theme, widget texts move to the locales; language names through Intl.DisplayNames.
4. Page: inline I18N removed; tx, h (escaped) and tb (escaped with bold values) over the locale from /api/config; language picker (🌐) writes language through POST /api/language (confirmed, logged), pins bubbleLanguage.
5. Themes: flavourTheme on /api/config and validateTheme keep only title, tagline, status labels, section headings; generateTheme returns uiLanguage, applied only when the locale exists.
6. Tests and README.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Commit 7ab2528 on feat/panels.
Decisions: locale files ship in the checkout (locales/); the page gets the merged dict (en first, then the language) in /api/config, so no extra static route. Values are plain text; the page escapes everything (h for HTML, tb for the two texts with bold values: ui.to and ui.themeNow). language in config accepts any locale code ([a-z]{2,3}(-x)?), the effective language is the code when a locale exists, else en; publicConfig gives language (effective), languageSetting, locale, languages. Picker: header button 🌐 <CODE> with radio list, POST /api/language with Host/Origin/X-Crew/confirmed, actions.log line language set; when the file has no bubbleLanguage the current one is written too. Widgets are recreated with the new language on the config reload.
Scope note: English-only HTTP API errors and CLI output (no nl branch before, e.g. not confirmed, agent is live) stay English and are documented as such; everything that had an nl/en branch or is page text is in the locales. Server texts moved: onboarding message and orchestrator ask, register placeholders, panel request template and example title, widget remove confirm, links, backlog, markdown and dev-server texts, crew you/shell/unknownRole, askTheme, summary prompt (follows bubbleLanguage as before), theme language name (meta.englishName).
Themes: validateTheme already built only flavour fields; flavourTheme now also filters saved themes before /api/config (labels only status keys, sections only section keys, no other texts). Theme prompt UI language: the model may return uiLanguage (code); set when the locale exists (logged as language set via theme), otherwise the page shows that it can be added (CREW-20). Not testable end to end without a model; uiLanguage parsing has a unit test.
Look unchanged: compared the old inline I18N block (git HEAD) with the new locales for nl and en, all strings and the function outputs (banner, closeText, onboardTitle, informed, ...) are identical; ui.you moved to crew.you, ui.running was unused. Time format kept: en uses en-GB.
Validation: npm test 169/169, npm run check ok, page script syntax checked. New test/i18n.test.mjs: shipped locales vs en.json, checkLocale errors, fallback and extra dirs, page and server only use existing keys, no inline text block in the page, onboarding wording, theme flavour filtering. Server tests: locale in /api/config, /api/language guards, set nl with pinned bubbleLanguage, widget recreated, unknown language falls back to en, saved theme filtered. Manual: own instance on 5277 with stub herdr and the Ruimtestation theme in nl: same texts as before, picker switched to English without restart, Close dialog in English, bubbleLanguage stayed nl.

crew-orch 2026-11-13: rebased onto main, npm test 169 pass, locales are in package.json files; fast-forward merged as b168a0e and pushed. Restarted 5192 and 5190; 5190 still loads language nl with the Night theme.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved every page and server text into locales/en.json and locales/nl.json with English fallback, added a key and placeholder check, a confirmed language picker, and limited themes to flavour texts. Verified with npm test (169 pass), npm run check, an old versus new string comparison and a headless Chrome check with stub herdr.
<!-- SECTION:FINAL_SUMMARY:END -->
