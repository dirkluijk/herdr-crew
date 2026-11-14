---
id: CREW-25
title: 'License, requirements and a README for new users'
status: Done
assignee:
  - '@m6-release'
created_date: '2026-11-14 12:58'
updated_date: '2026-11-14 13:39'
labels:
  - docs
  - release
dependencies:
  - CREW-24
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal (user 2026-11-14): the repo must be usable by anyone with Herdr. package.json says MIT but there is no LICENSE file. User decision: MIT, holder Dirk Luijk, year 2026. README: start with what herdr-crew is and a screenshot placeholder, then Requirements (Node 22+, Herdr with the features used, OpenCode as the best supported agent and what works for other agents, optional Backlog.md with minimal version for --json and --watch, optional model credentials, macOS versus Linux, Windows not supported), Install (git clone, node server.mjs install, node server.mjs doctor), Quick start (say maak een nieuwe Herdr crew or run /crew, see CREW-26), Uninstall, then the existing reference sections. Keep it factual; write prose with the writer subagent if available. No em dashes or en dashes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LICENSE contains the MIT license for Dirk Luijk, 2026
- [x] #2 README has Requirements, Install, Quick start and Uninstall sections that match install and doctor
- [x] #3 No personal paths or project names from other projects in README
- [x] #4 README.md is short and readable for new users, with emoji and the hero image, and links to DESIGN.md
- [x] #5 DESIGN.md contains all reference detail that left the README, with no facts lost
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. LICENSE (MIT, Dirk Luijk, 2026), add it to package.json files. 2. Collect facts: tested versions, Backlog.md versions for --json and --watch from its release notes, OpenCode only features, platforms. 3. Writer subagent for intro, Requirements, Install, Quick start, Uninstall and the skills section. 4. Merge with the existing reference sections, add a Commands reference and Development. 5. Check dashes, personal paths, and run the documented commands against temp dirs.

6. Widened scope: short README with emoji, hero image and screenshot; all detail to DESIGN.md with an Architecture section; screenshot from an own instance with fictional personas.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-14: scope change by the user: make the README user ready. README.md becomes simple and straightforward for humans, with emoji and an image: what it is, a hero image, why, requirements in short, install (clone, install, doctor), quick start (say maak een nieuwe Herdr crew or run /crew), what you see in the dashboard, uninstall, links. All the detail (configuration reference, persona fields, widgets and their options, panels, languages, safeguards, environment variables, CLI reference, limitations, architecture) moves to a new DESIGN.md, which README links to. Keep facts unchanged, only restructure and rewrite; let the writer subagent write the prose (emoji are explicitly wanted by the user here; still no em dashes or en dashes). Image: the orchestrator makes a hero illustration at docs/hero.png; add a dashboard screenshot only from your own instance with fictional personas and tasks (no real project names), for example docs/dashboard.png. Do not touch PLAN.md beyond a pointer to DESIGN.md if needed.

Branch feat/release, commit see git log (docs: add the MIT license and a README for new users).
- LICENSE is the standard MIT text, Copyright (c) 2026 Dirk Luijk; package.json files now includes LICENSE.
- README order: intro with a screenshot placeholder (HTML comment pointing to docs/screenshot.png, to be added), Requirements, Install, Quick start, Uninstall, Commands (the old usage block, updated with install, uninstall, doctor, locale and the new init flags, plus the init and send paragraphs), then the existing reference sections, Agent skills and commands (replaces Agent skill with its manual ln -s), Environment, Limitations, Development.
- Backlog.md versions from its GitHub release notes: task list --json since 1.49.0, --watch since 1.52.0, 1.53.0 fixes the CPU use and lets the watch exit with its parent, so 1.53.0+ is recommended. Herdr 0.9.5 and OpenCode 2.2.5 are named as tested versions, not minimums; doctor checks the Herdr features by help text.
- Install section says new OpenCode sessions pick up the links and does not mention /reload or a restart.
- Prose by the writer subagent from a fact sheet; checked for em and en dashes (none; the only ' -- ' is the herdr agent start argument separator in code), for personal paths and other project names (none; examples use shop-orch and Vera). The repository URL is the literal placeholder <repository URL> until the repo is public (CREW-27).
- Checked the documented commands against temp dirs: the manual init example, install --dry-run, uninstall --dry-run. npm test 196 pass, npm run check ok.

crew-orch 2026-11-14: hero illustration is docs/hero.jpg (1280x720, on main since the commit after 96457ab); rebase feat/release onto main to get it.

Widened scope done in a1ef6cf (after rebasing onto main for docs/hero.jpg).
- README.md is now short: hero image, what it is, Why, What you see with docs/dashboard.jpg, Requirements, Install, Quick start, Uninstall, Learn more, License. Emoji on section headings and a few bullets, prose by the writer subagent from a fact sheet. No em or en dashes.
- DESIGN.md holds everything else: a new Architecture section (file map of server.mjs, lib, widgets, public, locales, skills, commands, test), Requirements in detail, Install and doctor, Uninstall, The new crew flow, Commands (CLI reference, init and send details) and all earlier reference sections unchanged (Configuration through Limitations, Agent skills and commands, Environment, Development). A script compared every line of the old README (main and the first CREW-25 version) with README plus DESIGN: what is missing is only reworded intro text, the old Quick start and the manual ln -s install that install replaces; the two remaining facts (extracted from a project dashboard, default URL on 5190) were added to DESIGN.md.
- docs/dashboard.jpg (1440x1345, 246 kB): screenshot of my own dashboard on port 47310 for a fictional cosy-bakery project, with stub herdr, backlog and opencode commands on PATH (fake agents, statuses, bubbles and SHOP tasks), no model credentials, captured with headless Chrome over the DevTools protocol. Personas reuse the existing illustrated avatars (Noor, Pim, Tess, Ruben, Fenna, Daan) with fictional roles. Server stopped and temp files removed afterwards.
- PLAN.md: only the file list line now points to DESIGN.md. package.json files includes DESIGN.md, LICENSE and docs.
- npm test 196 pass, npm run check ok.

Pushed feat/release to origin on request (after the rebase onto main the commits are 8802358 and 0e0f720). Not merged.

crew-orch 2026-11-14: reviewed (README 60 lines with hero and a fictional dashboard screenshot, DESIGN.md 311 lines, LICENSE MIT 2026 Dirk Luijk, no dashes, no internal names), rebased, npm test 196 pass, fast-forward merged as 0e0f720; then set the real clone URL in README (377b0e4).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LICENSE (MIT, 2026 Dirk Luijk), a short README for humans with emoji, a hero illustration and a fictional dashboard screenshot, and DESIGN.md with all reference detail. Reviewed by crew-orch; npm test 196 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
