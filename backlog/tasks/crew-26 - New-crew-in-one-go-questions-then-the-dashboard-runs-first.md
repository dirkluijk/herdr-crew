---
id: CREW-26
title: 'New crew in one go: questions, then the dashboard runs first'
status: To Do
assignee:
  - '@m6-release'
created_date: '2026-11-14 12:58'
labels:
  - skill
  - onboarding
dependencies:
  - CREW-24
priority: high
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User wish 2026-11-14: when the user says maak een nieuwe Herdr crew (or make a new Herdr crew), or runs the /crew command, the agent asks a few questions right away and then the dashboard starts immediately, before any other agent is spawned, so the user sees everything happen. User decisions: trigger through the herdr-crew skill (a New crew section and a description that matches the phrase in Dutch and English) plus an OpenCode command commands/crew.md that install links. Flow: 1. Check prerequisites (HERDR_ENV, doctor in short form). 2. Ask with the question tool in one round: project directory (default cwd), orchestrator agent name (unique on the Herdr server, check herdr agent list) and persona (name, pronouns), UI and bubble language, theme in free text or default, avatar directory, port (default the first free port from 5190, files port plus one). 3. Write .herdr-crew.json with init using non interactive flags that must exist (for example --orchestrator NAME --persona-name --pronouns --theme TEXT --port auto --yes); register the orchestrator as lead with message prefixes; suggest .herdr-crew/ in .gitignore. 4. Start the dashboard in a split pane without focus with --no-prompt (theme already set via flag, or generated before start), wait for the URL line, open it in the browser (open on macOS, xdg-open on Linux), note pane and URL in the plan. 5. Rename tab and agent to the orchestrator name, make the orchestrator portrait (optional, image tool if available), then continue with the herdr-orchestrator workflow and only then start milestone agents. Avoid asking the theme question in the server pane: the server must not prompt when started by the agent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The phrase maak een nieuwe Herdr crew and /crew both start the flow with one round of questions
- [ ] #2 init supports the non interactive flags needed by the flow, including --port auto
- [ ] #3 The dashboard runs and opens in the browser before any milestone agent is started
- [ ] #4 End to end in a throwaway project with a test orchestrator: questions, config, dashboard URL open, no prompt in the server pane
- [ ] #5 Tests cover the new init flags and port selection; npm test and npm run check pass
<!-- AC:END -->
