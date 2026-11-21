---
"@herbertgao/pi-subagents": patch
---

Restore session-scoped agent type registration over the event bus (`subagents:rpc:register-agents`, `list-agents`, `unregister-agents`, and `subagents:agents-changed`) after the upstream 0.26.2 replay. `agency_register` and ccstyle Agent badge rows work again; `renderAgentName` prefers a `general-purpose` run's own name. A `register-agents` batch is now atomic—name collisions with file/default types reject the whole payload with no partial types or missing `agents-changed` notification. Upstream `0.26.2` get/list/workflow RPC behavior is unchanged.
