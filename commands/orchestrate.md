---
description: Make this session the Herdr orchestrator for the project. Optional argument is the orchestrator name.
---

Load the `herdr-orchestrator` skill and activate this session as the orchestrator, following its Orchestrator section.

Arguments: `$ARGUMENTS`

- If an argument is given, use it as the orchestrator name. Otherwise use the default from the skill.
- After activating, reply with a short status: the orchestrator name, the open tabs and milestone agents in this workspace, and whether Backlog.md is set up. Do not start any milestone agents yet unless the arguments ask for it.
