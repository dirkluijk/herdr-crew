---
id: CREW-27
title: Audit before making the repo public
status: Done
assignee:
  - '@crew-orch'
created_date: '2026-11-14 12:58'
updated_date: '2026-11-16 07:25'
labels:
  - release
dependencies: []
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Do this when the user wants to make dirkluijk/herdr-crew public (decision 2026-11-14: private first, public later). Check the full git history for secrets again (keys, tokens, the Foundry host), check backlog/, PLAN.md and README for references to other projects, employers or internal names (other-project, NS, Platform, Foundry resource names, personal paths) and decide what stays, check avatars and example configs, decide whether backlog/ ships, add a short CONTRIBUTING or issue guidance if wanted, then flip visibility with gh repo edit --visibility public only after the user's explicit go.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 History and files checked, findings and decisions recorded
- [x] #2 Visibility changed only after the user's explicit go
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-14: the user wants to keep the repo private for now; do not start this audit until the user asks.

crew-orch 2026-11-16: the user made the repo public himself; audit done afterwards. Secrets: none in 94 commits (keys, tokens, private keys, api key values, Foundry host and key prefix); only author email is the user's. Internal context found in PLAN.md, backlog tasks and .herdr-crew.json (other local project name and paths, platform and meeting deck names, pane ids, home paths, session ids). User decision: rewrite history. Backup mirror in the opencode temp dir (main b0ec641). git filter-repo (script in temp, nothing installed) with 13 literal replacements and .herdr-crew.json removed from all commits; verified zero hits in all history and commit messages; npm test 196 pass. PLAN.md made generic with local details in PLAN.local.md; .herdr-crew.json and PLAN.local.md gitignored. Force pushed main (e083ee6) and deleted a stale remote branch feat/release with old history. Old commits stay reachable by SHA on GitHub until GitHub support purges them. Also: topics, package.json repository/homepage/bugs, tag and release v0.1.0. Not done (user choice): secret scanning, SECURITY.md, CONTRIBUTING.md, branch protection.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repo audited after going public: no secrets; internal context removed from the whole history with git filter-repo and a force push; local crew config and notes kept out of git; topics, package.json links and release v0.1.0 added.
<!-- SECTION:FINAL_SUMMARY:END -->
