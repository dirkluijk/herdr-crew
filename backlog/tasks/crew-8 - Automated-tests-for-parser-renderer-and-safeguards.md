---
id: CREW-8
title: 'Automated tests for parser, renderer and safeguards'
status: Done
assignee:
  - '@m2-tests'
created_date: '2026-11-13 10:14'
updated_date: '2026-11-13 10:33'
labels:
  - quality
dependencies: []
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There are no tests yet; npm run check only runs node --check on all modules. Behaviour was verified by hand with curl and the Chrome DevTools protocol (see the history in PLAN.md). Add node:test tests without dependencies: parseScreen on captured OpenCode screens (prompt, shell output, tool output, empty input box), renderMarkdown (frontmatter, tables, lists, escaping, link schemes), personasFromPlan on a sample plan, registerPersona (new, update of one field, invalid), validateTheme (bad colours, enums, lengths), and an HTTP test of the guards: wrong Host 421, missing Origin or X-Crew 403, unconfirmed actions 400, files origin limited to configured files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 npm test runs the suite with node:test and no dependencies
- [x] #2 The cases above are covered and pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. npm test script: node --test on test/*.test.mjs (Node globs, no deps), so helpers and fixtures are not run as tests and test/screen.test.mjs from m1-parser is picked up.
2. Unit tests: test/markdown.test.mjs (renderMarkdown), test/init.test.mjs (personasFromPlan), test/onboarding.test.mjs (registerPersona on a temp config), test/theme.test.mjs (validateTheme).
3. HTTP test test/server.test.mjs: spawn server.mjs on two free ports outside 5190-5193 with a temp project dir, --no-prompt, model and image credentials removed from env, and a stub herdr/backlog on PATH so the live Herdr server is never touched. Cover 421 wrong Host, 403 missing Origin or X-Crew, 400 unconfirmed, and the files origin serving only listed files.
4. Known bugs found by tests: record in notes and mark the test as todo, no fixes outside scope.
5. Commit with Conventional Commits, no push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Orchestrator crew-orch 2026-11-13: assigned to milestone agent m2-tests (Tess). Split with CREW-1: the parseScreen tests (test/screen.test.mjs) are written by m1-parser; m2-tests owns everything else plus the npm test script (node --test, no dependencies). HTTP guard tests must start their own server on a free port, never 5190/5191/5192/5193, against a temporary project directory, never ~/workspace/other-project. Do not touch public/index.html or lib/screen.mjs. If a test reveals a bug, record it in the task notes and report back instead of fixing it outside the scope.

m2-tests (Tess) 2026-11-13: test suite added, owned by m2-tests.
- npm test = node --test 'test/*.test.mjs' (Node globs, no dependencies). Only *.test.mjs files run, so test/fixtures is not picked up, and test/screen.test.mjs from m1-parser is included automatically once it exists.
- test/markdown.test.mjs: renderMarkdown frontmatter, CRLF, tables (escaped pipes), lists (nested, ordered, continuation), headings, code, quotes, escaping, link schemes (http, https, mailto, # kept; javascript, data, file, vbscript, relative become text), quote breakout, markdownPage escaping.
- test/init.test.mjs: personasFromPlan on a sample plan (lead with prefixes, roles before a colon, pronoun filter, first mention wins, default prefix).
- test/onboarding.test.mjs: registerPersona new, create file, update of one field, rename, invalid inputs leave the file untouched; validPersona cleaning.
- test/theme.test.mjs: validateTheme bad colours, required colours, enums, clamping, text lengths and stripping, fonts, avatars.
- test/server.test.mjs: spawns server.mjs on two free ports (never 5190 to 5193) against a temp project under the OS temp dir, with --no-prompt, ANTHROPIC_*, OPENAI_* and HERDR_* removed from the env, and stub herdr and backlog commands (test/fixtures/bin) first on PATH, so the live Herdr server and the dashboard on 5190 are never touched. Covers wrong Host 421 (dashboard and files origin), missing or wrong Origin, missing X-Crew 403 on theme, onboard, agent and widget POSTs, unconfirmed 400 on theme, onboard, register, onboard, keys, type and widget actions, bad body 400, no prompt or keys reaching herdr, a confirmed widget action running, the dashboard serving no project files, and the files origin serving only listed files (outside files, symlinks out, unlisted keys, traversal, other widget ids 404; writes 405; cross-site 403; a listed file swapped for a symlink out 404).
- Missing Host: Node itself answers 400 (requireHostHeader) before the guard; the test asserts that.
- Result: 49 tests, 46 pass, 0 fail, 3 todo (known bugs below). npm run check still passes. Ran 4 times without flakes.

Bugs found (not fixed, out of scope; each has a todo test that passes once fixed, then drop the todo option):
1. lib/markdown.mjs inline(): emphasis runs after link rendering, so _x_ or *x* inside a URL becomes <em> inside the href, e.g. [a](https://example.com/_x_/y) gives href=https://example.com/<em>x</em>/y. Broken link, not an XSS (quotes stay escaped). Fix idea: stash links like code spans before emphasis.
2. lib/theme.mjs color(): the regex accepts 3, 5, 6 or 8 hex digits; #12345 (invalid CSS) passes and #1234 (valid CSS) is refused. Fix idea: /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.
3. lib/onboarding.mjs validPersona(): clean() cuts agent to 32 characters before the AGENT_NAME check, so a 33 character name is silently registered under a shorter name that Herdr never uses. Fix idea: validate the raw agent before cleaning.

AC #2 open: my part is covered and passes; the parseScreen cases wait on test/screen.test.mjs from m1-parser (CREW-1).

Committed as 131ab80 (test: add node:test suite ...), not pushed. Only package.json and my test files; test/screen.test.mjs, lib/screen.mjs and lib/crew.mjs from m1-parser are left uncommitted for m1. With m1's current screen.test.mjs on disk, npm test picks it up automatically.

AC2 verified 2026-11-13 after d2ee171: npm test runs 64 tests, 61 pass, 0 fail, 3 todo. Per file: init 5, markdown 13 (+1 todo), onboarding 6 (+1 todo), screen 15 (prompt, shell output, tool output, empty input box all covered), server 13, theme 9 (+1 todo). The 3 todo tests are the bugs listed above; the fixes wait on a follow-up task decided by the orchestrator.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an npm test suite on node:test with no dependencies (npm test = node --test 'test/*.test.mjs'). It covers renderMarkdown, personasFromPlan, registerPersona, validateTheme, parseScreen (test/screen.test.mjs by m1-parser) and an HTTP test of the guards: wrong Host 421, missing Origin or X-Crew 403, unconfirmed actions 400, and a files origin that serves only configured files. The HTTP test runs its own server on free ports outside 5190 to 5193 against a temporary project, with stub herdr and backlog commands, so it never touches a live dashboard or Herdr. Verified with npm test: 64 tests, 61 pass, 0 fail, 3 todo. The todo tests mark three bugs found (emphasis inside link URLs, hex colour lengths, agent names cut to 32 characters); they are not fixed here and wait on a follow-up task. Commits 131ab80 and d2ee171.
<!-- SECTION:FINAL_SUMMARY:END -->
