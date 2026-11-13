---
id: CREW-7
title: Install the skill as a symlink instead of a copy
status: Done
assignee:
  - '@m3-skill'
created_date: '2026-11-13 10:14'
updated_date: '2026-11-13 12:01'
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
- [x] #1 The skill works without editing after install and the commands in it resolve to the checkout
- [x] #2 With the user's go: the installed skill is a symlink to the repo
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Test what OpenCode prints as base directory for a symlinked skill. 2. With the symlink path: launcher skills/herdr-crew/crew.mjs that imports ../../server.mjs (decision crew-orch, option a). 3. Skill and README use node <base>/crew.mjs and document the symlink requirement. 4. Exact ~/.config change as a proposal in the notes, apply only with the user's go.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-13: user chose the skill base directory approach: the skill refers to server.mjs relative to the Base directory for this skill printed by the skill tool (skills/herdr-crew -> ../../server.mjs). First check whether OpenCode prints the symlink path or the resolved path for a symlinked skill; the resolved path is what makes ../../server.mjs work. If it prints the symlink path, report back before choosing a fallback. Installing the symlink in ~/.config still needs an explicit go.

m3-skill 2026-11-13: tested OpenCode v2.2.5 with a symlinked skill (project .opencode/skills/symprobe -> real dir, opencode run --standalone). The skill tool prints the SYMLINK path as Base directory, not the resolved one. So node <base>/../../server.mjs fails: Node normalizes .. lexically and looks for .opencode/server.mjs (MODULE_NOT_FOUND). Plain ls <base>/../../server.mjs does work because the kernel resolves physically, which makes the failure easy to miss. Fallbacks verified in the same setup: (a) a launcher inside the skill dir, skills/herdr-crew/crew.mjs with one line await import(new URL('../../server.mjs', import.meta.url)); node <base>/crew.mjs works because Node realpaths the main module by default, so import.meta.url is the repo path. No change to server.mjs needed, it has no main guard. (b) node "$(cd <base> && pwd -P)/../../server.mjs" also works, but is a shell trick every agent must copy exactly. (c) HERDR_CREW_CLI or a bin on PATH, as in the description. Recommendation: (a). Waiting for a decision from crew-orch before choosing.

crew-orch 2026-11-13: decision: option (a), the launcher skills/herdr-crew/crew.mjs. It stays within the user's choice (paths relative to the skill base directory). Document in the skill and README that it requires the symlink install (a copy would not find server.mjs) and breaks with --preserve-symlinks-main.

m3-skill: done in the repo (commit e83ed7d). skills/herdr-crew/crew.mjs is a one line launcher that imports ../../server.mjs relative to its own real path. SKILL.md has no placeholder any more: a section The herdr-crew command explains node <base>/crew.mjs with <base> from the Base directory line, and that it needs the symlink install (a copy cannot find the checkout, and it breaks under node --preserve-symlinks-main; fallback node <checkout>/server.mjs or HERDR_CREW_CLI). README Agent skill section shows the symlink install and the same limits. Verified: through a symlinked dir, node <link>/crew.mjs help and send work; with --preserve-symlinks-main it fails with ERR_MODULE_NOT_FOUND as expected.

Proposed change in ~/.config (NOT applied, needs the user's go):
The installed skill is a directory with only a sed-made SKILL.md (the placeholder replaced by the checkout path), nothing else. Replace it by a symlink. Do not keep a backup inside the skills directory, OpenCode would load it as a second herdr-crew skill.

  rm -r ~/.config/opencode/skills/herdr-crew
  ln -s ~/workspace/herdr-crew/skills/herdr-crew ~/.config/opencode/skills/herdr-crew
  node ~/.config/opencode/skills/herdr-crew/crew.mjs help

The last line should print herdr-crew 0.1.0 and the usage, including send. Running sessions keep the old skill text until they load the skill again.

crew-orch 2026-11-13: user gave the go. Backup of the old copy in the opencode temp dir (herdr-crew-skill-copy.bak), then rm -r and ln -s as proposed. node ~/.config/opencode/skills/herdr-crew/crew.mjs help prints herdr-crew 0.1.0 with send in the usage.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The skill no longer has a placeholder: it runs node <base>/crew.mjs, a launcher that reaches the checkout through the symlinked skill directory (OpenCode prints the symlink path as base directory, Node realpaths the main module). Verified with opencode run on a symlinked probe skill and node <link>/crew.mjs help and send through a symlink. Open: AC 2, replacing the installed copy by a symlink in ~/.config, needs the user's go; exact commands in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
