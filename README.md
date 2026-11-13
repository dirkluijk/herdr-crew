# herdr-crew

herdr-crew is a local web dashboard and an agent skill for projects with several coding agents, mostly OpenCode, running in [Herdr](https://herdr.dev). It was extracted from a project-specific dashboard. It requires Node 22 or newer (tested on Node 24), has no dependencies, and needs no global installation.

Plan, decisions and history: [PLAN.md](PLAN.md). Open work: `backlog task list --plain` (Backlog.md, prefix CREW).

## Quick start

From this checkout, run:

```sh
node server.mjs init --project /path/to/project --plan PLAN.md
node server.mjs --project /path/to/project
```

Open http://localhost:5190. You can also run `npx /path/to/herdr-crew --project /path/to/project` from a local checkout; `package.json` exposes the `herdr-crew` bin.

```text
herdr-crew [serve] [--project DIR] [--port N] [--theme ["free text"]] [--reset-theme] [--theme-avatars] [--no-prompt]
herdr-crew init [--project DIR] [--plan PLAN.md] [--import personas.json] [--avatars DIR] [--language nl|en] [--port N] [--force]
herdr-crew register <agent> --name NAME [--pronouns P] [--role ROLE] [--avatar KEY] [--traits a,b] [--project DIR]
herdr-crew send <agent> <text> [--timeout MS] [--interval MS]
```

`init` writes `<project>/.herdr-crew.json`. It reads personas from a plan: a back-ticked agent name followed by `(Name, pronouns)`, with the preceding clause ending in a colon as its role. It reads the orchestrator from `` `name`, persona Name (pronouns) `` and message prefixes from sentences such as `start with "Vera here."` or `start with "Vera hier."`. It also reads live Herdr labels in the form `<agent> (<Name>, <pronouns>)`. Use `--import` to add traits, quirk, session, avatar, mascot, lines, statuses, tasks, lead, and role from `personas.json`. `--avatars DIR` matches `<key>.png` by agent name or first name. If the plan says bubbles are Dutch, `init` chooses `nl`. `register` adds or updates a persona (for an existing persona only the changed fields are needed, e.g. `--avatar sjaak`); a running server reloads the config within about four seconds.

`send` is how agents message each other. `herdr agent prompt` pastes text and presses Enter, so a prompt that arrives while the user is typing in that agent's input box is submitted together with the draft. `send` waits until the agent is idle or done and its OpenCode input box is empty, checks again every 2 seconds (`--interval`), and then prompts. It exits 0 when sent, 2 after the timeout (`--timeout`, default 100000 ms) and 1 on other errors. The user can still start typing between the check and the paste; that window is a single Herdr call.

## Configuration

`<project>/.herdr-crew.json` is JSON to keep the tool dependency free.

| Key | Meaning |
| --- | --- |
| `id` | Optional stable project id for the browser layout key; defaults to a hash of the project path. |
| `title` | Dashboard title. |
| `language` | UI language, `nl` or `en`. |
| `bubbleLanguage` | Language for agent speech bubbles. |
| `port` | HTTP port; defaults to `5190`. |
| `workspace` | Optional Herdr workspace ID. Otherwise use `HERDR_WORKSPACE_ID` or the workspace where most agents have their cwd in the project. |
| `backlog` | True when `backlog/` or `.backlog/` exists. Shows Backlog.md tasks per persona via `backlog task list --json`. A task opens read only in a modal from `backlog task view <id> --json` (schema version 1): status, labels, dependencies that open in the same modal, acceptance criteria as checkboxes, and the markdown sections rendered on the server. Other Backlog.md versions get the `--plain` text. |
| `avatarDir` | Directory for persona avatars. |
| `terminalApp` | macOS app to bring to the front after Go to, for example Alacritty. `init` detects it from the terminal that started Herdr (`__CFBundleIdentifier`, variables such as `ALACRITTY_SOCKET` or `KITTY_WINDOW_ID`, then `TERM_PROGRAM`), or takes `HERDR_CREW_TERMINAL`. Without it, Go to only focuses the pane in Herdr. |
| `summaries` | `{ "lead": true, "model": ... }` for an optional lead summary. |
| `onboarding` | `via` is `"orchestrator"` (default) or `"direct"`; `message` is `null` or a template. Templates can use `{project}`, `{agent}`, `{persona}`, `{language}`, `{lead}`, and `{prefix}`. |
| `confirm` | `{ "prompt": false }`; set `prompt` to true to confirm chat messages. |
| `personas` | Agent and mascot entries; fields below. |
| `widgets` | Widget module entries; see Widgets. |
| `theme`, `themeAsked` | Theme saved by the app and whether it has asked for one. |

| Persona field | Meaning |
| --- | --- |
| `agent` | Lowercase Herdr agent name; also matched to the first word of the tab label. |
| `name`, `pronouns`, `role`, `avatar` | Display identity and avatar key. |
| `traits`, `quirk` | Persona details. |
| `tasks` | Task IDs. |
| `lead` | Orchestrator hero card; can have an optional two-paragraph model summary. |
| `messagePrefixes` | Prefixes used to recognise messages from this persona. |
| `session` | OpenCode session ID; supplies last words for closed agents via `opencode session export`. |
| `mascot` | A made-up colleague without a session, with rotating `lines[]` and `statuses[]`; no model calls. |

The dashboard reads live `working`, `idle`, `done`, and `blocked` status from `herdr agent list`. Cards show an agent's own Herdr `say` token as a speech bubble (`✍️ own words`), greyed as the previous turn when work resumes. If there is no bubble, the card can show the last visible screen lines (`🖥 screen`). It also shows the latest incoming message and its sender: a `[agent-name]` prefix, a persona's `messagePrefixes`, or `You`. The OpenCode footer supplies a context bar, yellow from 70 percent and red from 85 percent. Closed agents appear greyed with their last words. Cards show tasks. An optional lead summary (`🤖`) needs `ANTHROPIC_FOUNDRY_API_KEY` and `ANTHROPIC_FOUNDRY_BASE_URL`, or `ANTHROPIC_API_KEY`.

Drag a card by its handle (⠿) to change the order, or use the ↑ and ↓ buttons, which also work from the keyboard. 📌 pins a card: pinned cards get their own section at the top, so new agents and status changes do not move them. Dropping a card on the pinned section pins it; dragging a pinned card back to its section unpins it. The layout lives in the browser's localStorage under `herdr-crew:layout:<project>:<port>`, where `<project>` is `id` from `.herdr-crew.json` or a short hash of the project path, so several dashboards on one machine keep their own layout. Cards without a stored position follow the ordered ones. The ↺ button in the header resets the layout.

State lives in `<project>/.herdr-crew/`: `memory.json` (recent bubbles, incoming messages, context use), `actions.log`, widget logs, and generated theme avatars. Add `.herdr-crew/` to the project's `.gitignore`.

## New agents and onboarding

Live agents missing from the config, and registered agents without a bubble yet, appear in New on board with a new or not registered badge. A banner lists them. Register adds a persona from the dashboard, prefilled from the tab label. Informed agents leave the New section; the dashboard remembers that they were informed.

By default, with a lead persona and `onboarding.via` set to `orchestrator`, Inform and the banner button send one confirmed message to the orchestrator when it is idle or done. The message asks the lead to give each agent a persona, register it with the exact `herdr-crew register` command shown, and pass on the crew conventions. With `via: "direct"` or no lead, the message goes to the agent instead and explains bubbles and message prefixes.

## Prompted theme

On the first interactive start (TTY, unless `--no-prompt`), or with `--theme`, the app asks for a theme in free text, such as `retro arcade`. With Anthropic credentials, a model returns JSON for colours, font stacks, optional Google Fonts (up to three, loaded by the browser from fonts.googleapis.com), card radius, border, shadow, avatar shape and uppercase setting, background pattern, status labels, section headings, title, tagline, and avatar style. Patterns include gradient, solid, grid, dots, stripes, and scanlines. The server validates colours, enums, lengths, and characters before saving `theme` in `.herdr-crew.json`; later starts reuse it. `--reset-theme` or Back to default restores the default. The header's `🎨` button changes the theme at runtime. Without model access, the default theme stays in place.

Only the theme text and project name go to the theme model. Screens, tasks, and messages are never sent.

### Theme avatars

While a theme is active, a card shows the theme avatar of its persona when one exists, and the normal avatar otherwise. There are two ways to make them.

The default is to let an OpenCode agent with an image tool make the set, the same way new persona avatars are made (see the Avatars section of the herdr-crew skill). Only the persona's name, pronouns, role, and traits go into the image prompt, together with `theme.avatarStyle` from `.herdr-crew.json`. Pass two or three images from `avatarDir` as references so the faces stay recognisable. For each persona:

1. Take the theme slug: `theme.name` in lowercase, every run of characters other than `a-z` and `0-9` replaced by `-`, leading and trailing `-` removed, at most 40 characters (`Retro Arcade` becomes `retro-arcade`).
2. Save a square PNG of 384 by 384 pixels as `<project>/.herdr-crew/avatars/<slug>/<agent>.png`, where `<agent>` is the persona's agent name.
3. Link it in `.herdr-crew.json` under the theme: `"theme": { ..., "avatars": { "<agent>": "<slug>/<agent>.png" } }`. Keep the other theme keys as they are.

A running server reloads the config within about four seconds and serves the file as `/theme-avatars/<slug>/<agent>.png`. A new theme or Back to default starts with an empty `avatars` map.

The server can also generate the set itself through an OpenAI-compatible images API, if you have an image deployment or an OpenAI API key: `--theme-avatars` or the Avatars in this theme button. It uses `OPENAI_FOUNDRY_API_KEY` and `OPENAI_FOUNDRY_BASE_URL`, or `OPENAI_API_KEY`. `HERDR_CREW_IMAGE_MODEL` sets the model or Foundry deployment name and defaults to `gpt-image-1`. It writes the same files and links them in `theme.avatars`; failures leave the normal avatar in place.

## Widgets

Each `widgets` entry names a built-in module or a path relative to the project:

```json
{"module":"dev-server","options":{"id":"app","title":"Dev server","cwd":".","command":["npm","run","dev"],"port":5191,"pages":[{"title":"App","path":"/"}],"requireNodeModules":true,"startTimeoutMs":10000}}
```

Widget modules default-export `create({ project, stateDir, options, language })`, returning `{ id, title, view(), actions: { name: { confirm(): string, run() } }, log() }`. `view()` returns `{ state, text, url, info, warning, error, links, buttons, busy }`. `state` is `on`, `off`, or `busy`; `links` contain `{ title, url, enabled }`, and `buttons` contain `{ action, label, disabled }`. The page renders this generically. Every widget action requires confirmation and is logged. A widget can also return `files` (see `links`) and `dispose()`, which the server calls when the entry is removed or changed; use it to stop timers or file watchers.

Widgets reload without a restart, like personas. When the `widgets` array in `.herdr-crew.json` changes, the server creates instances for new or changed entries, disposes the removed ones and keeps the unchanged ones; the page picks up the new list within a few seconds. Disposing a `dev-server` widget leaves its process running; use its Stop button first. An entry that fails to load shows up as a panel with the error, and a second entry with the same id is skipped. A project module (a path in `module`) is imported once per server run, so changes to its code still need a restart.

Each panel has a ✕ button that removes its entry from `.herdr-crew.json` after a confirmation. It is a POST to `/api/widgets/<id>/remove` with the same Host, Origin, `X-Crew` and `confirmed` checks as other actions, and it is logged with the removed entry in `actions.log`. The action name `remove` is therefore reserved; a widget's own action with that name is not reachable.

The built-in `dev-server` accepts `id`, `title`, `cwd` (relative to the project), `command` (array; defaults to `npm run dev`), `port` (at least 1024), `pages` with `{ title, path }`, `requireNodeModules`, and `startTimeoutMs`. It starts the command detached, logging to `.herdr-crew/widget-<id>.log`. Stop refuses to kill a process on the port if its cwd is outside the widget cwd. The widget never installs anything or runs git.

The built-in `links` widget shows a list of links with an optional note per link and for the widget:

```json
{"module":"links","options":{"id":"meeting","title":"Meeting","note":"Shown above the list.","links":[
  {"label":"Slides","file":"meetings/deck.html","note":"Opens on the files origin."},
  {"label":"Notes","file":"notes/cheat-sheet.md"},
  {"label":"RFC","url":"https://example.com/rfc"}]}}
```

`url` takes http and https only. `file` is a path relative to the project; `render` is `html`, `markdown` or `text` and defaults to the extension. Browsers block `file://` links from an http page, so the server serves exactly these files, read only, on a second origin: `http://localhost:<port + 1>/files/<widget>/<key>` (change it with `filesPort` or `--files-port`). That listener starts when the first widget lists a file and follows the current widgets: files of a removed widget are no longer served. It only answers GET and HEAD for configured files whose real path, after resolving symlinks, is still the configured file inside the project. There is no listing, the Host header must match, and requests with `Sec-Fetch-Site: cross-site` are refused. Markdown is rendered to HTML with a Content Security Policy that allows no scripts; HTML files are served as they are. Because the files run on their own origin, a served page cannot call the dashboard API (its Origin does not match) and keeps its own localStorage. A page that stores state in localStorage therefore starts empty there, even if you used it earlier via `file://`.

Browsers keep localStorage per origin, that is per scheme, host and port. Choices you made in a deck opened via `file://` do not show up on the files origin, and choices made on the files origin do not show up via `file://` or on the dashboard. What you save on the files origin stays there across dashboard restarts, as long as the files port stays the same and you open the links from the dashboard (they use `localhost`; `127.0.0.1` is a different origin). If the dashboard port changes, the files port moves with it, unless you pin it with `filesPort`. herdr-crew does not copy, import or seed localStorage for served pages, and it never changes the served files.

## Safeguards

Go to focuses an agent with `herdr agent focus`; Zoom toggles `herdr pane zoom --toggle`; Screen reads `herdr agent read --source visible`. Card chat sends on Enter only to idle or done agents with an empty input box, and checks both again just before sending; otherwise it answers 409 with the reason. Onboarding messages use the same check. The input box check reads the OpenCode TUI, so prompts to other kinds of agents are refused. Blocked agents have an Answer dialog for allowlisted keys or text, always with confirmation.

The server listens only on `127.0.0.1`. The Host header must be `localhost` or `127.0.0.1` with the port, otherwise the server returns 421 to guard against DNS rebinding. Every POST needs a same-origin Origin header and `X-Crew: 1`; cross-site requests cannot set that header without a preflight, which the server never approves. Persona IDs resolve to live panes on the server. Herdr calls use `execFile`, argument arrays, and a fixed command map. Static files are limited to the page, project avatars, and generated theme avatars. Every action goes into `.herdr-crew/actions.log`. Set `confirm.prompt` to true to require confirmation for chat messages.

## Agent skill

The draft skill is at [`skills/herdr-crew/SKILL.md`](skills/herdr-crew/SKILL.md). It covers the crew conventions for every agent, and for the orchestrator how to set up and run the dashboard and how to register and brief new agents. It works next to an orchestration skill such as herdr-orchestrator, which only needs one line pointing to it. It is not installed anywhere. Install it as a symlink to this checkout, for example for OpenCode:

```sh
ln -s "$PWD/skills/herdr-crew" ~/.config/opencode/skills/herdr-crew
```

The skill runs commands through `skills/herdr-crew/crew.mjs`, a launcher that imports `../../server.mjs`. OpenCode reports the symlink path as the skill's base directory, and Node resolves the symlink when it loads the launcher, so the import reaches this checkout and skill changes apply without reinstalling. A copy of the skill has no checkout two levels up, and `node --preserve-symlinks-main` keeps the symlink path; in both cases the launcher fails and you need `node <checkout>/server.mjs`.

## Environment

| Variable | Use |
| --- | --- |
| `HERDR_WORKSPACE_ID` | Workspace fallback when `workspace` is absent. |
| `HERDR_CREW_TERMINAL` | Used by `init` for `terminalApp`, before detection. |
| `HERDR_CREW_CLI` | Command shown in onboarding messages; defaults to `node <path>/server.mjs`. |
| `HERDR_CREW_IMAGE_MODEL` | Image model; defaults to `gpt-image-1`. |
| `PORT` | Server port. |
| `ANTHROPIC_FOUNDRY_API_KEY`, `ANTHROPIC_FOUNDRY_BASE_URL` | Foundry credentials for theme and lead summary calls. |
| `ANTHROPIC_API_KEY` | Alternative Anthropic credential. |
| `OPENAI_FOUNDRY_API_KEY`, `OPENAI_FOUNDRY_BASE_URL` | Foundry credentials for theme avatars. |
| `OPENAI_API_KEY` | Alternative image API credential. |

## Limitations

Screen parsing assumes the OpenCode TUI. Other agents still get status, own bubbles, and buttons, but screen fallback and the context bar may be empty. Theme avatar generation through the images API has not been tested end to end: the Azure Foundry resource used during development had no image deployment, so the agent route is the default.
