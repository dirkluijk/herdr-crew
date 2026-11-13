---
id: CREW-2
title: Theme avatars need an image deployment or API key
status: To Do
assignee: []
created_date: '2026-11-13 10:14'
labels:
  - theme
dependencies: []
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server.mjs --theme-avatars and the Avatars in this theme button call generateAvatars in lib/theme.mjs: one portrait per persona through an OpenAI compatible POST /images/generations (OPENAI_FOUNDRY_API_KEY plus OPENAI_FOUNDRY_BASE_URL, or OPENAI_API_KEY; model HERDR_CREW_IMAGE_MODEL, default gpt-image-1), stored in .herdr-crew/avatars/<theme-slug>/<agent>.png and linked under theme.avatars in .herdr-crew.json. Never tested end to end: on 2026-11-13 the Azure Foundry resource returned DeploymentNotFound for gpt-image-1, gpt-image-1.5, gpt-image-2 and gpt-image-1-mini. Options: ask for an image deployment on that resource, use another key, or drop the API path and let an OpenCode agent with an image tool make the themed set (the way new persona avatars are made, see the Avatars section in the skill). Only persona name, pronouns, role and traits may go into image prompts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Either theme avatars are generated end to end for a test project, or the API path is replaced or removed and the README says how themed avatars are made
<!-- AC:END -->
