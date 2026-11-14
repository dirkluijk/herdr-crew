---
name: herdr-orchestrator
description: Run a project with one long-lived orchestrator OpenCode session and short-lived milestone agents in separate Herdr tabs, using Backlog.md tasks as the handover. Use when the user activates orchestrator mode (the /orchestrate command), asks to start, brief or close a milestone agent, or when you are a milestone agent that must report back to the orchestrator.
---

# Herdr orchestrator

One project, several OpenCode sessions in Herdr:

- **Orchestrator**: one session that stays open for the whole project. It plans, starts milestone agents, receives their reports and decides what happens next. It does little implementation itself.
- **Milestone agents**: one OpenCode session per milestone, each in its own Herdr tab. They live as long as the milestone and are closed afterwards. They can use regular subagents to split up or parallelize their own work.
- **Backlog.md** is the handover. Context, acceptance criteria, progress and implementation notes live in the tasks, not in chat messages. Messages between agents stay short and point to a task.

Agents address each other by Herdr agent name, never by pane ID.

## Prerequisites

1. `test "${HERDR_ENV:-}" = 1`. If this fails, tell the user you are not running inside Herdr and stop.
2. Print `herdr --skill` once if the Herdr skill is not in your context yet, for exact CLI syntax.
3. Herdr agent names must match `[a-z][a-z0-9_-]{0,31}` and be unique across the whole Herdr server, so also across other projects.
4. If the project has a `.herdr-crew.json`, also load the `herdr-crew` skill for the crew dashboard, personas and briefing line.

## Orchestrator

### Activate

1. Pick the orchestrator name: the name given by the user, otherwise `orchestrator`. Check `herdr agent list` for a live agent with that name in another pane. If it is taken, ask the user for a project specific name such as `shop-orch` for a project called shop.
2. Name the tab and the agent:

   ```sh
   herdr tab rename "$HERDR_TAB_ID" <orch-name>
   herdr agent rename "$HERDR_PANE_ID" <orch-name>
   ```

3. Check whether the project uses Backlog.md (a `backlog/` directory or the `backlog` CLI). If not, ask the user whether to initialize it before starting milestones.
4. Show the user the current state: open tabs in this workspace (`herdr tab list --workspace "$HERDR_WORKSPACE_ID"`), live milestone agents and the Backlog.md tasks that are in progress.

### Start a milestone agent

1. Make sure the milestone has Backlog.md tasks with enough context to work from without this conversation. Create or refine them first if needed.
2. Name the agent after the milestone, for example `m2-auth`. Use the same string as the tab label.
3. Default to the project directory as cwd. Only use a separate git worktree (`herdr worktree`) if milestones run in parallel on the same code, and ask the user first.
4. Create the tab without stealing focus and start OpenCode in it:

   ```sh
   herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label <name> --no-focus
   herdr agent start <name> --kind opencode --pane <root_pane.pane_id> --timeout 60000
   ```

   Read the pane ID from `.result.root_pane.pane_id`. Do not guess it.
5. Send the briefing without `--wait`: with herdr-crew through its send command (see Report back), otherwise with `herdr agent prompt <name> "<briefing>"`. Then check with `herdr agent get <name>` after a few seconds that its status is `working`.

Briefing template (keep it to one paragraph, no double quotes inside):

> You are milestone agent `<name>` in Herdr. The orchestrator is `<orch-name>`. Load the `herdr-orchestrator` skill and follow the milestone agent section. Your milestone: `<short goal>`. Tasks: `<TASK-ids>`. Read them in Backlog.md first. If the project has a .herdr-crew.json, load the herdr-crew skill (own bubble at the end of every turn). `<constraints, e.g. do not open a PR, stop after TASK-7>`.

### Receive reports

- Messages starting with `[<agent-name>]` are reports from milestone agents, not from the user.
- Read the referenced tasks in Backlog.md before acting on a report.
- Decide the next step: brief the agent with follow-up work, answer its question, start the next milestone, or ask the user when a decision is theirs.
- Keep the user informed with a short summary per report.

### Send follow-up work

- With herdr-crew, send follow-up work through its send command. It refuses working and blocked agents and waits for an empty input box, so the user can be typing in that tab too.
- Only prompt an agent that is `idle` or `done` (`herdr agent get <name>`). Never prompt one that is `working` or `blocked`.
- If an agent is `blocked`, read its screen (`herdr agent read <name> --source recent-unwrapped --lines 80`) and ask the user before answering a permission or question dialog for it.

### Close a milestone

1. Check in Backlog.md that the tasks are done and the notes are complete.
2. Ask the user before closing, unless they already said to.
3. Close the tab: `herdr tab close <tab_id>`. Only close tabs that you created for milestone agents.

## Milestone agent

You were started by the orchestrator with a briefing that names you and the orchestrator.

### Work

- Work from the Backlog.md tasks in the briefing. Set a task to In Progress when you start on it.
- Keep progress, decisions and implementation notes in the task as you go. The tab will be closed after the milestone, so anything not in Backlog.md (or in git) is lost.
- Use regular subagents for parallel or isolated work as usual.
- Stay within the briefing. Report back instead of expanding the scope.

### Report back

Report when the milestone is done, when you are stuck, or when you need a decision.

1. Update the Backlog.md tasks first: status, notes, open questions.
2. Send one short line. Do not put quotes or apostrophes inside the message. Longer content belongs in the task, not in the message.

   With the herdr-crew skill loaded, use its send command. It waits until the orchestrator is idle or done and its input box is empty, so the report does not land in a draft the user is typing:

   ```sh
   node <herdr-crew base>/crew.mjs send <orch-name> '[<name>] <TASK-ids>: <done | blocked | question>. <one sentence>. See task notes.' --timeout 110000
   ```

   Exit code 2 means it timed out: run the same command again.

   Without herdr-crew, wait until the orchestrator is ready for input, then prompt it without --wait. The shell tool has a default timeout of 2 minutes, so wait in chunks and repeat on a timeout error. herdr agent wait also returns when the orchestrator is blocked, so check that its status is idle or done before you prompt:

   ```sh
   herdr agent wait <orch-name> --timeout 110000
   herdr agent prompt <orch-name> '[<name>] <TASK-ids>: <done | blocked | question>. <one sentence>. See task notes.'
   ```

3. Then stop and wait for new instructions. Do not prompt the orchestrator again until it has answered.
