---
"@herbertgao/pi-subagents": minor
---

Replay upstream pi-subagents 0.25.0. The built-in general-purpose agent can spawn its own subagents, and Settings writes the global file unless the project already has one. A finished nested agent is dropped with its parent on a session switch. Unconsumed top-level results and a failed worktree cleanup still stay recoverable.
