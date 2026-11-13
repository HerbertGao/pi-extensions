---
"@herbertgao/pi-subagents": minor
---

Replay upstream pi-subagents 0.24.0. A nested spawn over the nested concurrency limit is refused instead of queued, and Fleet view lists those nested agents under their parent with the model and thinking level. Unconsumed results and a failed worktree cleanup still stay recoverable.
