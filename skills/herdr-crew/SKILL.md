---
name: herdr-crew
description: Crew conventions for projects with several coding agents in Herdr and a herdr-crew dashboard. Use when you run as an agent in Herdr in a project with a .herdr-crew.json, when you start or brief other agents as orchestrator, when you set up or run the herdr-crew dashboard for a project, or when you register a persona.
---

# herdr-crew

Check that `HERDR_ENV=1` and that the project or its parent contains `.herdr-crew.json`. If either check fails, these conventions do not apply.

## The herdr-crew command

Run herdr-crew through the launcher in this skill's directory: `node <base>/crew.mjs <command>`, where `<base>` is the path after "Base directory for this skill" in the skill tool output. The commands below write it as `node <base>/crew.mjs`; fill in the real path. `node <base>/crew.mjs help` lists all commands.

The launcher needs the skill installed as a symlink to `skills/herdr-crew` in the herdr-crew checkout. It does not work with `node --preserve-symlinks-main`. With a copy it cannot find the checkout; use `node <checkout>/server.mjs` instead, or the `HERDR_CREW_CLI` value if the dashboard shows one.

## Your bubble

At the end of every turn, including when you stop to wait or report, set your own bubble:

```sh
herdr pane report-metadata "$HERDR_PANE_ID" --source crew --token say="<text>"
```

Use one sentence of at most 80 characters; Herdr cuts longer token values. Write in the `bubbleLanguage` from `.herdr-crew.json`. Say what you are doing or just finished. Do not include secrets, paths with tokens, customer data, or credentials. Make this the last action of the turn: the dashboard treats a bubble as fresh when it was set around the last status change.

## Messages

Treat messages starting with `[agent-name]` as coming from another agent. Messages starting with the orchestrator's `messagePrefixes`, such as `Vera hier.` or `Vera here.`, come from the orchestrator. Anything else comes from the user. As orchestrator, start every message with your prefix. When reporting to another agent, start with `[your-agent-name]`.

Send every message to another agent, including reports, briefings and follow-up work, with `send` instead of `herdr agent prompt`:

```sh
node <base>/crew.mjs send <agent> '[your-agent-name] <message>' --timeout 110000
```

`herdr agent prompt` pastes the text and presses Enter. If the user is typing in that agent's input box, your message is glued to their draft and both go out as one. `send` waits until the agent is idle or done and its input box is empty, checks again every 2 seconds, and only then prompts. Exit code 0 means sent. Exit code 2 means it timed out: the reason is on stderr, and you can run the same command again. Exit code 1 means the agent does not exist or the prompt failed. Keep the timeout under your shell tool's limit; the default is 100000 ms. Do not put quotes or apostrophes inside the message.

## Persona and tab

Find your persona in `.herdr-crew.json`. Name your Herdr agent `<agent>` and your tab `<agent> (<Name>, <pronouns>)` so the dashboard can match you. Register a missing persona with the `register` command:

```sh
node <base>/crew.mjs register <agent> --name NAME --pronouns P --role ROLE --project DIR
```

## Orchestrator

### Set up the dashboard

Only do this when the user asks for a crew dashboard or agrees to your proposal. Ask before you write files in the project.

1. Create the config once, from the plan and the live tab labels:

   ```sh
   node <base>/crew.mjs init --project "$PWD" --plan PLAN.md [--avatars DIR] [--import personas.json]
   ```

   Check the personas in `.herdr-crew.json` (name, pronouns, role, `lead: true` and `messagePrefixes` on your own entry) and fix what `init` guessed wrong. Suggest adding `.herdr-crew/` to `.gitignore`.
2. Start the server in its own pane, without taking focus, and keep your own pane free:

   ```sh
   herdr pane split --current --direction down --cwd "$PWD" --no-focus
   herdr pane run <new-pane-id> "node <base>/crew.mjs --project $PWD"
   ```

   Read the pane ID from `.result.pane.pane_id`. On the first start the server asks the user for a theme in that pane; let the user answer, do not type it for them.
3. Check `herdr pane read <new-pane-id> --source recent-unwrapped --lines 10` for the line with the URL (default http://localhost:5190) and give the user that URL.
4. Note the pane ID and URL in the plan or the project task, so a later session can find the running dashboard.

The server reloads `.herdr-crew.json` on its own. Restart it only for a new port or new widgets, and only after asking.

### Starting agents

When the project has a `.herdr-crew.json`, add these steps to the usual start of a milestone agent:

1. Pick a persona and register it before you start the agent, so its card is ready from the first poll:

   ```sh
   node <base>/crew.mjs register <agent> --project "$PWD" --name NAME --pronouns P --role ROLE
   ```

2. Make the portrait and add it to the persona (see Avatars).
3. Label the tab `<agent> (<Name>, <pronouns>)` and name the Herdr agent `<agent>`.
4. Put the crew line in the briefing (see below).

### Avatars

The orchestrator makes the portrait of every new persona while registering it. When the orchestrator is busy, it asks the new agent to make its own portrait during onboarding, with the same rules.

- Location: `<avatarDir>/<first-name>.png`, with `avatarDir` from `.herdr-crew.json` and the first name in lowercase (`sjaak.png`). Without an `avatarDir`, ask the user where avatars go before you set one.
- Format: square PNG, 384 by 384 pixels. Resize a larger result, for example with `sips -Z 384 <file>` on macOS.
- Style: match the existing set and pass two or three of its files as reference images. Without references, use: warm flat digital illustration, head and shoulders, friendly face, a solid pastel circle behind the person on a white background, holding one object that fits the role or quirk, no text or logos.
- Content: only name, pronouns, role, traits and quirk go into the image prompt. No screens, tasks, messages or project secrets.
- Then link it: `register <agent> --project "$PWD" --avatar <first-name>` (the other fields stay as they are). The dashboard picks it up within a few seconds.
- Do not overwrite an existing avatar of another persona; pick a different key when the first name is taken.

Include one line in every briefing pointing to this skill. If the agent does not have it, give the bubble command and language instead. For example:

> Load the herdr-crew skill: set your own Dutch bubble of at most 80 characters at the end of every turn.

When the dashboard asks you to onboard new agents, give each a persona with a name, pronouns, and role; register it; and send the agent a short message with its persona and these conventions through `send` (see Messages).

Do not edit `.herdr-crew/` state files by hand. Do not start, stop, or reconfigure the dashboard unless the user asks.
