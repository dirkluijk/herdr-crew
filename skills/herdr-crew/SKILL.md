---
name: herdr-crew
description: Crew conventions for projects with several coding agents in Herdr and a herdr-crew dashboard. Use when you run as an agent in Herdr in a project with a .herdr-crew.json, when you start or brief other agents as orchestrator, or when you register a persona.
---

# herdr-crew

Check that `HERDR_ENV=1` and that the project or its parent contains `.herdr-crew.json`. If either check fails, these conventions do not apply.

## Your bubble

At the end of every turn, including when you stop to wait or report, set your own bubble:

```sh
herdr pane report-metadata "$HERDR_PANE_ID" --source crew --token say="<text>"
```

Use one sentence of at most 80 characters; Herdr cuts longer token values. Write in the `bubbleLanguage` from `.herdr-crew.json`. Say what you are doing or just finished. Do not include secrets, paths with tokens, customer data, or credentials. Make this the last action of the turn: the dashboard treats a bubble as fresh when it was set around the last status change.

## Messages

Treat messages starting with `[agent-name]` as coming from another agent. Messages starting with the orchestrator's `messagePrefixes`, such as `Vera hier.` or `Vera here.`, come from the orchestrator. Anything else comes from the user. As orchestrator, start every message with your prefix. When reporting to another agent, start with `[your-agent-name]`.

## Persona and tab

Find your persona in `.herdr-crew.json`. Name your Herdr agent `<agent>` and your tab `<agent> (<Name>, <pronouns>)` so the dashboard can match you. Register a missing persona with `herdr-crew register` using the path to `server.mjs` in the herdr-crew checkout, or the `HERDR_CREW_CLI` value if the dashboard shows one:

```sh
node /path/to/herdr-crew/server.mjs register <agent> --name NAME --pronouns P --role ROLE --project DIR
```

## Orchestrator

Register each agent before or just after starting it. Include one line in every briefing pointing to this skill. If the agent does not have it, give the bubble command and language instead. For example:

> Load the herdr-crew skill: set your own Dutch bubble of at most 80 characters at the end of every turn.

When the dashboard asks you to onboard new agents, give each a persona with a name, pronouns, and role; register it; and send the agent a short message with its persona and these conventions. Prompt agents only when they are idle or done.

Do not edit `.herdr-crew/` state files by hand. Do not start, stop, or reconfigure the dashboard unless the user asks.
