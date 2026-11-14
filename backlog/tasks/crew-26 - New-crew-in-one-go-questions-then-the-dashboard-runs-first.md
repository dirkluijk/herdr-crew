---
id: CREW-26
title: 'New crew in one go: questions, then the dashboard runs first'
status: Done
assignee:
  - '@m6-release'
created_date: '2026-11-14 12:58'
updated_date: '2026-11-14 13:39'
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
- [x] #1 The phrase maak een nieuwe Herdr crew and /crew both start the flow with one round of questions
- [x] #2 init supports the non interactive flags needed by the flow, including --port auto
- [x] #3 The dashboard runs and opens in the browser before any milestone agent is started
- [x] #4 End to end in a throwaway project with a test orchestrator: questions, config, dashboard URL open, no prompt in the server pane
- [x] #5 Tests cover the new init flags and port selection; npm test and npm run check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. init flags: --orchestrator, --persona-name, --pronouns, --role, --prefixes, --bubble-language, --port auto, --theme TEXT|default, --title; avatars dir created. 2. serve --open and doctor --short. 3. New crew section in skills/herdr-crew/SKILL.md plus description trigger, commands/crew.md. 4. Tests for flags, ports and --open. 5. End to end in throwaway projects with a project level .opencode config dir.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branch feat/release, commits b326ca9 and f4bf432.
- init: --orchestrator AGENT --persona-name NAME [--pronouns] [--role] [--prefixes A,B] adds the lead (first in the list, replaces a lead from the plan); prefixes default to NAME here. plus NAME hier. when the bubble language is nl. With a lead from flags init does not read live tab labels, because the workspace may hold tabs of other projects (seen in the first try: the crew tabs of this repo ended up as personas). --port auto: first pair from 5190 where port and port+1 are free (steps of 2), so 5190 and 5192 are skipped while they run. --theme TEXT generates the theme inside init (model credentials) and always sets themeAsked, so the server never asks in its pane; --theme default keeps the default. --avatars creates the directory. init prints lead, port, URL and a .gitignore tip when .herdr-crew/ is not ignored. No --yes flag: init never asks anything.
- serve --open opens the URL once the server listens (open on macOS, xdg-open elsewhere). doctor --short prints only non ok lines.
- Skill: description now matches make a new Herdr crew / maak een nieuwe Herdr crew and /crew. New crew section: check (only missing Node or Herdr stops), one question round, init, rename agent and tab to the persona, dashboard in a split pane with --no-prompt --open, wait for the URL line, optional portrait, then the herdr-orchestrator workflow with the persona tab label kept; no milestone agents in the flow. Agent and tab are renamed before the dashboard starts, so the card is live from the first poll.
- End to end (2026-11-14, about 13:15 UTC, 14:15 CET): throwaway git projects in the session temp dir, skills and commands linked with install --config-dir <project>/.opencode (project skills win over the global ones), each in its own Herdr workspace so the 5190 and 5192 dashboards did not see them. Phrase maak een nieuwe Herdr crew: one round of 8 questions; answers bakery-orch, Bram he/him, English dashboard with Dutch bubbles, theme een gezellige bakkerij, avatars, port auto, gitignore yes. Result: config with lead and prefixes, theme Cosy Bakery generated by init, port 5194, .herdr-crew/ in .gitignore, agent and tab renamed, dashboard pane started with --no-prompt --open and showed no theme question, /api/agents showed the live lead card with avatar bram.png made by the agent, and it then asked about plan and Backlog.md without starting agents. /crew in a second project: same one round of questions (dismissed). Both workspaces closed and the temp dirs removed afterwards.
- Found during the run and fixed in f4bf432: (1) doctor reported the commands/crew.md link as missing in the global config, and the first skill text stopped on any missing line; now only Node or Herdr stop the flow. (2) /reload in an OpenCode session restarts the shared OpenCode service and interrupts every session on the machine (it interrupted this agent too). The install and uninstall messages no longer suggest /reload; they say new sessions pick the change up. Worth knowing for orchestrators: never send /reload to an agent.
- The browser open itself is covered by the test with stub open and xdg-open; in the end to end run the server was started with --open on port 5194.
- Validation: npm test 194 pass, npm run check ok.

crew-orch 2026-11-14: rebased, npm test 196 pass, fast-forward merged as 1229896 and pushed; restarted 5192 and 5190. Linking commands/crew.md into the user's config waits for the user's go.
<!-- SECTION:NOTES:END -->
