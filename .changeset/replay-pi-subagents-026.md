---
"@herbertgao/pi-subagents": minor
---

Replay upstream pi-subagents 0.26.0. Asking for a number of agents runs those agents in parallel unless you ask for a workflow. A workflow schema is checked before the agent starts, a failed call can explain why, and the script reference can move into a skill. Unconsumed results and a failed worktree cleanup still stay recoverable.
