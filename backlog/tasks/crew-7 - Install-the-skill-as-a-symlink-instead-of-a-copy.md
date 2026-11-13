---
id: CREW-7
title: Install the skill as a symlink instead of a copy
status: To Do
assignee: []
created_date: '2026-11-13 10:14'
labels:
  - skill
dependencies: []
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The skill is installed as a copy: ~/.config/opencode/skills/herdr-crew/SKILL.md was made from skills/herdr-crew/SKILL.md with sed, replacing the placeholder /path/to/herdr-crew by the absolute checkout path, so every skill change needs a new copy. A symlink to skills/herdr-crew would stay in sync, but then the skill must not depend on a placeholder. Options: refer to the server through the skill base directory (the skill tool prints Base directory for this skill; check whether OpenCode shows the symlink path or the resolved one), through HERDR_CREW_CLI, or through a herdr-crew bin on PATH (npm link counts as a global install and needs a go). Changing ~/.config needs an explicit go from the user.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The skill works without editing after install and the commands in it resolve to the checkout
- [ ] #2 With the user's go: the installed skill is a symlink to the repo
<!-- AC:END -->
