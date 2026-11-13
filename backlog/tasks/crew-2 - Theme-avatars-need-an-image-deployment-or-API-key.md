---
id: CREW-2
title: Theme avatars need an image deployment or API key
status: To Do
assignee:
  - '@m2-tests'
created_date: '2026-11-13 10:14'
updated_date: '2026-11-13 11:38'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
crew-orch 2026-11-13: user decision: keep the images API path and fix the model. The OpenCode image tool works with openai/gpt-image-2 in this setup, so test generateAvatars end to end with a deployment that exists (via HERDR_CREW_IMAGE_MODEL) against a temporary test project, then adjust the default model and README. Only persona name, pronouns, role and traits go into prompts.

m2-tests 2026-11-13 11:38 UTC (12:38 CET): blocked, no working credentials for the images API path. Nothing changed in code or README.
- End to end run: server.mjs --theme-avatars with HERDR_CREW_IMAGE_MODEL=gpt-image-2 against a temporary project (one persona, a theme with avatarStyle), stub herdr on PATH, free ports. The server called POST /images/generations on the Azure Foundry resource from OPENAI_FOUNDRY_BASE_URL (path /openai/v1) and got 404 DeploymentNotFound. theme.avatars stayed {} and no file was written, so the failure path degrades cleanly.
- Direct probes on the same endpoint: gpt-image-2, gpt-image-1 and dall-e-3 all 404 DeploymentNotFound. GET /models lists catalog models (gpt-image-1, 1-mini, 1.5, 2, 2-flare, 2.5-flare, 2.5-sunburst, dall-e-2, dall-e-3), but these are models the resource could deploy, not deployments; none is deployed.
- The OpenCode image tool that works with openai/gpt-image-2 uses the openai provider with OAuth (ChatGPT login) in the OpenCode auth store, not an API key. That token cannot be used as OPENAI_API_KEY for api.openai.com/v1/images/generations, and there is no OPENAI_API_KEY in the environment.
- Options: (a) deploy an image model (for example gpt-image-2) on the Foundry resource and pass the deployment name via HERDR_CREW_IMAGE_MODEL, then rerun this test; (b) provide an OpenAI API key as OPENAI_API_KEY; (c) drop the API path and let an OpenCode agent with the image tool make the themed set, like new persona avatars. Needs a decision from the user.
<!-- SECTION:NOTES:END -->
