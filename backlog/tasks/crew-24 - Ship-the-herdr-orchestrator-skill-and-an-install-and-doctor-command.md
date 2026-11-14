---
id: CREW-24
title: Ship the herdr-orchestrator skill and an install and doctor command
status: To Do
assignee:
  - '@m6-release'
created_date: '2026-11-14 12:58'
labels:
  - skill
  - release
dependencies: []
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal (user 2026-11-14): anyone with Herdr can use herdr-crew from a git clone; the repo is private now and will be public later. User decisions: 1. The herdr-orchestrator skill moves into the repo as skills/herdr-orchestrator/SKILL.md, copied from ~/.config/opencode/skills/herdr-orchestrator/SKILL.md (do not change ~/.config; the user's installed copy is replaced by a symlink only after an explicit go, which the orchestrator handles). Generalize project specific examples (for example proj-orch) where needed. 2. Ship OpenCode commands in the repo, for example commands/orchestrate.md (copy of the user's ~/.config/opencode/command/orchestrate.md) and commands/crew.md (made in CREW-26; leave a placeholder or coordinate). 3. Add node server.mjs install: shows exactly which symlinks it will create in the OpenCode config dir (skills/herdr-crew, skills/herdr-orchestrator, command files; respect OPENCODE_CONFIG_DIR or XDG_CONFIG_HOME, default ~/.config/opencode), asks for confirmation (or --yes), never overwrites a real file or directory (it reports it and stops, unless --force with a backup outside the skills dir, because OpenCode would load a backup inside it as a second skill), and is idempotent for correct symlinks. Add uninstall that only removes symlinks pointing into this checkout. 4. Add node server.mjs doctor: checks Node version (22+), herdr presence and version and the features used (agent read --format ansi, pane report-metadata), opencode presence and version, backlog presence and version (--json and --watch support, optional), the skill and command symlinks, and prints ok, warning or missing per item with a hint. Read only. Tests use a temporary config dir and stub binaries. Do not run install against the real ~/.config in tests or manual checks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 skills/herdr-orchestrator/SKILL.md and commands/orchestrate.md are in the repo
- [ ] #2 install shows its plan, asks for confirmation, creates symlinks in the OpenCode config dir, never overwrites real files, and is idempotent; uninstall removes only its own symlinks
- [ ] #3 doctor reports Node, Herdr, OpenCode, Backlog.md and the symlinks with hints
- [ ] #4 Tests use a temporary config dir and stubs; npm test and npm run check pass
<!-- AC:END -->
