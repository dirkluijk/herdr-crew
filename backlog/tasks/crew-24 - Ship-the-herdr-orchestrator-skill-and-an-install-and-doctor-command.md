---
id: CREW-24
title: Ship the herdr-orchestrator skill and an install and doctor command
status: In Progress
assignee:
  - '@m6-release'
created_date: '2026-11-14 12:58'
updated_date: '2026-11-14 13:03'
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
- [x] #1 skills/herdr-orchestrator/SKILL.md and commands/orchestrate.md are in the repo
- [x] #2 install shows its plan, asks for confirmation, creates symlinks in the OpenCode config dir, never overwrites real files, and is idempotent; uninstall removes only its own symlinks
- [x] #3 doctor reports Node, Herdr, OpenCode, Backlog.md and the symlinks with hints
- [x] #4 Tests use a temporary config dir and stubs; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Copy the orchestrator skill to skills/herdr-orchestrator and the orchestrate command to commands/, generalize proj-orch. 2. lib/install.mjs: config dir resolution, plan with states create/ok/link/file, apply with --force backup, uninstall of own links only, CLI flow with confirmation. 3. lib/doctor.mjs: read only checks via --version and --help. 4. Wire install, uninstall, doctor into server.mjs and help. 5. test/install.test.mjs with temp config dirs and stub binaries.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branch feat/release, commit 5ad2e9c.
- skills/herdr-orchestrator/SKILL.md is a copy of the installed one (2026-11-13), only change: example name proj-orch became shop-orch. commands/orchestrate.md is a verbatim copy of ~/.config/opencode/commands/orchestrate.md (the user has commands/, not command/).
- install links every skills/<dir> with a SKILL.md and every commands/*.md, so commands/crew.md from CREW-26 is picked up without code changes. Config dir: --config-dir, else OPENCODE_CONFIG_DIR, else XDG_CONFIG_HOME/opencode, else ~/.config/opencode. OpenCode V2 docs only document ~/.config/opencode/skills and commands; OPENCODE_CONFIG_DIR is kept as the task asked.
- States per path: create, ok (already links here), other link, exists (real file or dir). Any conflict without --force: prints the plan, changes nothing at all (no partial install), exit 1. --force moves the old path to <config dir>/herdr-crew-backup/<timestamp>/<rel>, outside skills/ and commands/ so OpenCode does not load it as a second skill. Confirmation: [y/N] on a TTY, --yes otherwise; without a TTY and without --yes nothing changes. --dry-run shows the plan only.
- uninstall removes every symlink in skills/ and commands/ that resolves into this checkout (also broken ones), nothing else.
- OpenCode V2 reloads skills and commands on its own, so the messages mention /reload instead of a restart.
- doctor: Node 22+, herdr --version plus help text checks for agent read --format and pane report-metadata --token, HERDR_ENV, opencode --version, backlog --version plus task list --help for --json and --watch, model and image credentials (optional), and each link. Prints ok, warning or missing with a hint; exit 1 when something is missing. Only --version and --help calls.
- For the user's own machine (doctor run read only on the real config): skills/herdr-crew links to the main checkout, skills/herdr-orchestrator and commands/orchestrate.md are real files, so install there needs --force (backup) after the explicit go, as planned.
- Validation: node --test test/install.test.mjs 11 pass (temp config dirs, HOME and XDG_CONFIG_HOME also in temp, stub binaries), npm test 184 pass, npm run check ok, manual install/--force/uninstall run against a temp config dir.
<!-- SECTION:NOTES:END -->
