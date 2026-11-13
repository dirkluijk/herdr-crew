---
id: CREW-9
title: Fix three bugs found by the test suite
status: Done
assignee:
  - '@m2-tests'
created_date: '2026-11-13 11:35'
updated_date: '2026-11-13 11:36'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CREW-8 suite (npm test) found three bugs, each covered by a test marked todo. Fix them and drop the todo option so the tests run as normal tests. 1. lib/markdown.mjs inline(): emphasis runs after link rendering, so _x_ or *x* inside a URL becomes <em> inside the href (e.g. [a](https://example.com/_x_/y)). Broken link, not XSS. Fix idea: stash links like code spans before emphasis. 2. lib/theme.mjs color(): the hex regex accepts 3, 5, 6 or 8 digits; #12345 (invalid CSS) passes and #1234 (valid CSS) is refused. Fix idea: /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i. 3. lib/onboarding.mjs validPersona(): clean() cuts agent to 32 characters before the AGENT_NAME check, so a 33 character name is silently registered under a shorter name Herdr never uses. Fix idea: validate the raw agent name before cleaning. Constraints: the other-project dashboard on 5190 and the herdr-crew dashboard on 5192 run from this checkout; do not restart them; do not touch public/index.html; keep .herdr-crew.json backward compatible (existing themes with 5 digit colours should not break loading; check how an invalid saved colour is handled).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The three todo tests run as normal tests and pass
- [x] #2 npm test and npm run check pass
- [x] #3 Loading an existing .herdr-crew.json with a theme still works
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. markdown inline(): stash rendered links as placeholders (like code spans) before emphasis, restore after.
2. theme color(): regex for 3, 4, 6 or 8 hex digits.
3. validPersona(): refuse a raw agent name that does not match AGENT_NAME (after trim) instead of cutting it.
4. Drop the todo options; add a test that loading a config whose saved theme has a 5 digit colour still works (loadConfig does not revalidate themes).
5. npm test, npm run check, commit with git add -p.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
m2-tests 2026-11-13:
1. lib/markdown.mjs: links are rendered into placeholders (like code spans) before emphasis runs, so * and _ in a URL or in the ref text of a non-http link stay intact. Emphasis is applied to the link label separately, so [**b**](url) still works, and emphasis around a link still works.
2. lib/theme.mjs: color() accepts only 3, 4, 6 or 8 hex digits.
3. lib/onboarding.mjs: validPersona() checks the raw agent name (trimmed) against AGENT_NAME before cleaning, so a 33 character name is refused instead of cut. Leading and trailing spaces are still accepted and trimmed; control characters inside the name are refused.
Backward compatibility: saved themes are not revalidated on load (loadConfig returns theme as stored, and public/index.html sets colors as CSS variables as is), so a config with an old 5 digit colour still loads; the browser ignores that one invalid variable, as before. Covered by a new test in test/theme.test.mjs.
Validation: npm test 66 tests, 66 pass, 0 fail, 0 todo; npm run check passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the three bugs found by the CREW-8 suite: emphasis no longer runs inside link URLs (links are stashed before emphasis), theme colours accept exactly 3, 4, 6 or 8 hex digits, and agent names longer than 32 characters are refused instead of cut. The todo tests now run as normal tests, with extra cases for labels, refs and colour lengths, and a test that a saved theme with an old 5 digit colour still loads. Verified with npm test (66 pass, 0 fail, 0 todo) and npm run check.
<!-- SECTION:FINAL_SUMMARY:END -->
