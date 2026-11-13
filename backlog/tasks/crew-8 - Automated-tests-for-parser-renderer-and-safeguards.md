---
id: CREW-8
title: 'Automated tests for parser, renderer and safeguards'
status: To Do
assignee: []
created_date: '2026-11-13 10:14'
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
- [ ] #1 npm test runs the suite with node:test and no dependencies
- [ ] #2 The cases above are covered and pass
<!-- AC:END -->
