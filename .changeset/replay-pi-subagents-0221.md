---
"@herbertgao/pi-subagents": minor
---

Replay subagents onto upstream 0.22.1. Other extensions can steer a running agent over `subagents:rpc:steer`, and every agent reports per-message `subagents:usage` until `subagents:disposed`. A resumed run gets a fresh turn budget, a subagent inherits the parent session's thinking level, and an append-mode agent no longer repeats the parent's skills and working directory. Unconsumed results and a failed worktree cleanup still stay recoverable.
