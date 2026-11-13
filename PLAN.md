# herdr-crew plan

## Goal

herdr-crew is a reusable local web dashboard and agent skill for projects with several coding agents in Herdr.
Most agents use OpenCode. Herdr is the terminal multiplexer they run in.
The dashboard shows who is working on what and lets the user steer agents safely.
The skill gives agents shared conventions for their own speech bubble, message prefixes, personas, and onboarding.
The app has zero dependencies, requires Node 22 or newer, and starts with `node server.mjs`.
Development used Node 24.

## Status (as of 2026-11-13)

Version: `0.1.0`.
Local repository: `~/workspace/herdr-crew`, branch `main`, remote `origin` at https://github.com/dirkluijk/herdr-crew (private).
The running instance serves `~/workspace/other-project` at http://localhost:5190.
Its files origin is http://localhost:5191.
It runs in Herdr pane `w2B:p11` in that workspace.
Its config is `~/workspace/other-project/.herdr-crew.json`.
The config has more than 15 personas, the Night theme, a links widget named `deck`, and a dev-server widget named `docs-pushed`.
That instance belongs to other-project. Do not reconfigure it from this repo.
The herdr-crew orchestrator may restart it after a merge into main, with the command in that pane plus `--no-prompt`, and reports each restart to the user (user decision 2026-11-13).
The older dashboard is still in `other-project/dashboard/` on port `5180`.
Pixel built that project-specific dashboard; it is not maintained here.
The skill is installed as a symlink: `~/.config/opencode/skills/herdr-crew` points to `skills/herdr-crew` in this checkout, so skill changes are live without copying.
Agents run the CLI through `node <skill base directory>/crew.mjs`, a launcher that reaches `server.mjs` through the symlink; it needs the symlink install and does not work under `node --preserve-symlinks-main`.
The installed herdr-orchestrator skill has Prerequisites step 4 to load the herdr-crew skill when a project has `.herdr-crew.json`, a crew line in the briefing template, and uses the herdr-crew send command for reports, briefings, and follow-up work when herdr-crew is in use.
Milestone agent `x-crewkit` (persona Rosa) built this under orchestrator Vera in the other-project workspace.
This repo has its own crew: orchestrator `crew-orch` (persona Noor) in Herdr workspace `w2G`, config `.herdr-crew.json`, avatars in `avatars/`.
Its dashboard runs at http://localhost:5192 (files origin 5193) in Herdr pane `w2G:p4`.
The test suite has 110 `node:test` tests (`npm test`) and no dependencies.

## Architecture (file map)

`server.mjs`: CLI and HTTP server. Commands are `serve` (default), `init`, `register`, `send`, and `help`.
`send <agent> <text> [--timeout MS] [--interval MS]` waits until the agent is idle or done and its OpenCode input box is empty before sending the prompt; exit code 2 means it timed out.
Its flags include `--project`, `--port`, `--theme`, `--reset-theme`, `--theme-avatars`, `--no-prompt`, `--files-port`, and `--theme-model`.
It serves the page, `/events` with server-sent snapshot events, `/api/agents`, `/api/config`, `/api/theme`, `/api/widgets`, and actions.
It reloads `.herdr-crew.json` on change and runs a second listener for widget files.

`lib/config.mjs`: config defaults, loading and saving `.herdr-crew.json`, and onboarding templates in Dutch and English.
`lib/crew.mjs`: polls `herdr agent list`, `herdr tab list`, and `herdr agent read --source visible` for live agents, every second while a browser is connected and every 4 seconds otherwise, and right after every dashboard action.
It follows Backlog.md through `backlog task list --json --watch` (polling every 15 seconds when `--watch` is not available) and exports OpenCode sessions every 5 minutes for closed personas with a session id.
It stores memory in `<project>/.herdr-crew/memory.json`, written only when it changed.
`lib/live.mjs`: the poll scheduler, the SSE hub that only sends a snapshot when its content changed (plus an `alive` heartbeat every 5 seconds), and the reader for the concatenated JSON of `--watch`.
The page updates cards by key: only cards whose data changed are rebuilt, so hover, selection, scroll and drafts survive.
Its snapshot includes status, the agent's own say-token bubble, screen fallback, last incoming message and sender, context use, new or unregistered agents, and mascots.
`lib/screen.mjs`: ANSI stripping, secret redaction, and OpenCode screen parsing; it distinguishes tool blocks from user prompts by border colour in the ANSI visible read (`herdr agent read --source visible --format ansi`), ignores blocks cut off at the top of the viewport, and detects drafts in the OpenCode input box (`inputDraft`).
`lib/actions.mjs`: Host and Origin checks, fixed Herdr command map through `execFile`, action endpoints, and `actions.log`; dashboard prompts and onboarding refuse to submit into a draft (409), and Go to (focus) is logged and returns `terminalApp` and `raised`.
Agent actions include focus, zoom, screen, prompt, dialog keys or text, onboarding, and registration.
It also handles the crew onboarding endpoint.
`lib/onboarding.mjs`: persona validation, `registerPersona` (add or update only the supplied fields), and onboarding messages sent through the orchestrator or directly to an agent.
`lib/summary.mjs`: optional two-paragraph lead-persona summary through an Anthropic-compatible Messages API, with thinking off.
It uses `ANTHROPIC_FOUNDRY_*` or `ANTHROPIC_API_KEY`.
`lib/theme.mjs`: prompted theme generation and validation, plus avatars through an images API.
`lib/init.mjs`: config initialization from plan persona patterns, live tab labels, optional `personas.json` import, and macOS terminal app detection for Go to from the environment (`HERDR_CREW_TERMINAL` first, then bundle id, terminal variables, and `TERM_PROGRAM`).
`lib/markdown.mjs`: small Markdown renderer for the links and markdown widgets and Backlog.md task fields in the task modal.
`public/index.html`: the page, with Dutch and English strings, themes, cards, chat, dialogs, widgets, drag, and pin layout.
The task modal renders `backlog task view <id> --json` (schemaVersion 1) with a status pill, read only acceptance criteria checkboxes, sections, and clickable dependencies; it falls back to plain text for an unknown schemaVersion.
`lib/widgets.mjs`: the widget set that hot reloads `widgets` entries (keep, create, dispose) and removes an entry for the remove button.
`lib/project-file.mjs`: the real path rule for project files, shared by the links and markdown widgets.
`widgets/dev-server.mjs`, `widgets/links.mjs`, `widgets/backlog.mjs` and `widgets/markdown.mjs`: built-in widgets; backlog and markdown export `validate(options)`.
`skills/herdr-crew/SKILL.md`: agent skill, with `skills/herdr-crew/crew.mjs` as launcher.
`README.md`: user documentation.
`backlog/`: this project's Backlog.md data, using the `CREW` prefix.
`test/`: `node:test` suites for screen parsing, markdown, init, onboarding, theme, live updates, and HTTP guards, with stub `herdr`, `backlog`, and `open` commands in `test/fixtures/bin`.

## How to run and check

Run from this repository. Initialize a project config, then start its dashboard:

```sh
node server.mjs init --project <dir> --plan PLAN.md
node server.mjs --project <dir>
```

For a syntax check, run:

```sh
npm run check
```

That runs `node --check` on all modules. Run `npm test` for the `node:test` suite; it starts its own servers on free ports against temporary projects and never touches running dashboards.
Verification to date used `curl` against the API and headless Chrome through the DevTools protocol.
Plain `--screenshot` may run before the first snapshot arrives. Wait for the cards or use the protocol.

## Decisions

Each decision below was made on 2026-11-13.

2026-11-13: Use JSON for `.herdr-crew.json` instead of YAML to keep zero dependencies.
2026-11-13: Keep the STS-47 safeguards so dashboard actions cannot bypass the original safety checks.
2026-11-13: Bind only to `127.0.0.1` and require a `localhost` or `127.0.0.1` Host with the port; return 421 otherwise to guard against DNS rebinding.
2026-11-13: Require a same-origin Origin and `X-Crew: 1` on every POST so cross-origin pages cannot issue actions.
2026-11-13: Address agents by persona id, resolve live panes server-side, and run Herdr only via `execFile` and a fixed command map so requests cannot select arbitrary panes or commands.
2026-11-13: Send prompts only to idle or done agents after a fresh status check; confirm dialog answers, onboarding, registration, widget, and theme actions, and log every action in `.herdr-crew/actions.log` to retain the STS-47 safeguards.
2026-11-13: Have agents set their own bubble with the Herdr say token at the end of each turn, at most 80 characters because Herdr cuts longer values; reserve model summaries for the lead persona.
2026-11-13: Route new or unregistered agent onboarding through the orchestrator by default (`onboarding.via orchestrator`) and hot-reload config after `register` so adding a persona needs no restart.
2026-11-13: Let the orchestrator create each new persona's portrait in the existing style on registration, saved as `<avatarDir>/<first-name>.png` at 384 px; if that is unavailable, the agent creates one during onboarding.
2026-11-13: Generate themes from free text at interactive start, via `--theme`, or via the header button; validate and save the model's JSON in the project config so the theme persists.
2026-11-13: Send only theme text and project name to the model and keep the default theme without model access to limit what leaves the project.
2026-11-13: Render widget plugins from a generic view model and confirm and log every widget action to apply the same action rules to widgets.
2026-11-13: Serve links widget files from a separate origin on port plus one so pages with scripts cannot call the dashboard API; their localStorage is separate (CREW-5).
2026-11-13: Store card order and pins in the browser per dashboard instance (project id or path hash plus port), not on the server, to keep layouts local to that instance.
2026-11-13: Install nothing globally and change nothing under `~/.config` without an explicit go from the user.
2026-11-13: Move this project out of other-project into its own repo and hand it to its own orchestrator.
2026-11-13: Tell tool blocks from prompts by border colour in the ANSI visible read, keeping reads on `--source visible` (CREW-1).
2026-11-13: Keep the images API path for theme avatars, but document an OpenCode agent with an image tool as the default route because no image deployment or API key is available (CREW-2).
2026-11-13: Document only that the links widget files origin starts with its own localStorage; no export, import, or seed helper (CREW-5).
2026-11-13: Host the repo privately on GitHub as `dirkluijk/herdr-crew` (CREW-6).
2026-11-13: Install the skill as a symlink and reach `server.mjs` through the `crew.mjs` launcher because OpenCode reports the symlink path as skill base directory (CREW-7).
2026-11-13: Never submit a prompt into a draft: agents and the dashboard wait for idle or done and an empty input box; the small race between check and send is accepted (CREW-10).
2026-11-13: Poll every second while a browser is connected, poll right after actions, follow Backlog.md with `--watch`, and send and redraw only what changed (CREW-11).
2026-11-13: Render Backlog.md tasks in the dashboard modal from the stable JSON output instead of linking to backlog browser (CREW-13).

## History

The earlier work is in `~/workspace/other-project` under Backlog.md prefix `STS`.
From that directory, read a task with `backlog task view STS-<n> --plain`.

STS-12: Bram's first dashboard exploration, closed as future work.
STS-46: Pixel's original dashboard in `other-project/dashboard/`, with personas, avatars, statuses, and bubbles.
STS-47: Herdr buttons, safeguards, and the self-written bubble via the say token.
STS-48: mascot persona Bertus Hazelaar.
STS-49: docs server widget for pushed docs.
STS-51: docs server widget for live docs.
STS-54: extraction to this repo, including the generic app, init and register, orchestrator onboarding, prompted themes, skill draft, and avatar decision. Its implementation notes contain verification details.
STS-55: links widget with read-only local files.
STS-56: drag and pin cards with a layout per dashboard instance.
STS-57: this handover.

## Open work

The tasks are in this repo's `backlog/`. Read the task before taking it on.

All tasks CREW-1 to CREW-13 are Done as of 2026-11-13; check `backlog task list --plain` for new work.

## Working agreements for agents in this repo

Backlog.md is the source of truth. Follow `AGENTS.md` for task work.
Use Conventional Commits with types such as `feat`, `fix`, `docs`, and `style`, and scopes such as `ui`, `widgets`, and `skill`.
Keep the app dependency free.
Agents set their own Herdr say-token bubble at the end of each turn and use their persona's message prefix.
Onboard new agents through the orchestrator by default.
Any new action that changes something needs the Host and Origin guards, confirmation unless it is a plain chat message, and a line in `actions.log`.
Do not edit files in projects using this dashboard, except their `.herdr-crew.json` when asked.
The installed skill is a symlink, so skill changes are live for new sessions; changes to other files under `~/.config` still need an explicit go from the user.
Agents send messages to other agents with the herdr-crew send command.
Agents commit but do not push; the orchestrator pushes `main` to `origin` after a finished task.
