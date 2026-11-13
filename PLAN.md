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
Local repository: `~/workspace/herdr-crew`, branch `main`, with no remote.
The running instance serves `~/workspace/other-project` at http://localhost:5190.
Its files origin is http://localhost:5191.
It runs in Herdr pane `w2B:pZ` in that workspace.
Its config is `~/workspace/other-project/.herdr-crew.json`.
The config has more than 15 personas, the Night theme, a links widget named `deck`, and a dev-server widget named `docs-pushed`.
That instance belongs to other-project. Do not stop or reconfigure it from this repo.
The older dashboard is still in `other-project/dashboard/` on port `5180`.
Pixel built that project-specific dashboard; it is not maintained here.
The skill is installed as a copy in `~/.config/opencode/skills/herdr-crew/`.
In that copy, `/path/to/herdr-crew` was replaced by the absolute path.
The installed herdr-orchestrator skill has an added Prerequisites step 4: if a project has `.herdr-crew.json`, load the herdr-crew skill.
Milestone agent `x-crewkit` (persona Rosa) built this under orchestrator Vera in the other-project workspace.

## Architecture (file map)

`server.mjs`: CLI and HTTP server. Commands are `serve` (default), `init`, `register`, and `help`.
Its flags include `--project`, `--port`, `--theme`, `--reset-theme`, `--theme-avatars`, `--no-prompt`, `--files-port`, and `--theme-model`.
It serves the page, `/events` with server-sent snapshot events, `/api/agents`, `/api/config`, `/api/theme`, `/api/widgets`, and actions.
It reloads `.herdr-crew.json` on change and runs a second listener for widget files.

`lib/config.mjs`: config defaults, loading and saving `.herdr-crew.json`, and onboarding templates in Dutch and English.
`lib/crew.mjs`: polls `herdr agent list`, `herdr tab list`, and `herdr agent read --source visible` for live agents every 4 seconds.
It checks Backlog.md every 15 seconds and exports OpenCode sessions every 5 minutes for closed personas with a session id.
It stores memory in `<project>/.herdr-crew/memory.json`.
Its snapshot includes status, the agent's own say-token bubble, screen fallback, last incoming message and sender, context use, new or unregistered agents, and mascots.
`lib/screen.mjs`: ANSI stripping, secret redaction, and OpenCode screen parsing.
`lib/actions.mjs`: Host and Origin checks, fixed Herdr command map through `execFile`, action endpoints, and `actions.log`.
Agent actions include focus, zoom, screen, prompt, dialog keys or text, onboarding, and registration.
It also handles the crew onboarding endpoint.
`lib/onboarding.mjs`: persona validation, `registerPersona` (add or update only the supplied fields), and onboarding messages sent through the orchestrator or directly to an agent.
`lib/summary.mjs`: optional two-paragraph lead-persona summary through an Anthropic-compatible Messages API, with thinking off.
It uses `ANTHROPIC_FOUNDRY_*` or `ANTHROPIC_API_KEY`.
`lib/theme.mjs`: prompted theme generation and validation, plus avatars through an images API.
`lib/init.mjs`: config initialization from plan persona patterns, live tab labels, and optional `personas.json` import.
`lib/markdown.mjs`: small Markdown renderer for the links widget.
`public/index.html`: the page, with Dutch and English strings, themes, cards, chat, dialogs, widgets, drag, and pin layout.
`widgets/dev-server.mjs` and `widgets/links.mjs`: built-in widgets.
`skills/herdr-crew/SKILL.md`: agent skill draft.
`README.md`: user documentation.
`backlog/`: this project's Backlog.md data, using the `CREW` prefix.

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

That runs `node --check` on all modules. There are no automated tests yet; see CREW-8.
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

CREW-1: Screen parser shows tool output as an incoming message (high).
CREW-2: Theme avatars need an image deployment or API key.
CREW-3: Add the crew line to the herdr-orchestrator briefing template (needs a go).
CREW-4: Manual mouse drag test of card reordering.
CREW-5: Deck choices start empty on the links widget files origin.
CREW-6: Add a remote for the herdr-crew repo.
CREW-7: Install the skill as a symlink instead of a copy (needs a go).
CREW-8: Automated tests for parser, renderer, and safeguards.

## Working agreements for agents in this repo

Backlog.md is the source of truth. Follow `AGENTS.md` for task work.
Use Conventional Commits with types such as `feat`, `fix`, `docs`, and `style`, and scopes such as `ui`, `widgets`, and `skill`.
Keep the app dependency free.
Agents set their own Herdr say-token bubble at the end of each turn and use their persona's message prefix.
Onboard new agents through the orchestrator by default.
Any new action that changes something needs the Host and Origin guards, confirmation unless it is a plain chat message, and a line in `actions.log`.
Do not edit files in projects using this dashboard, except their `.herdr-crew.json` when asked.
After a skill change, refresh the installed copy in `~/.config/opencode/skills/herdr-crew/` only with an explicit go, until CREW-7 changes that setup.
