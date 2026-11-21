---
"@herbertgao/pi-subagents": patch
---

Restore session-scoped agent type registration over the event bus (`subagents:rpc:register-agents`, `list-agents`, `unregister-agents`, and `subagents:agents-changed`) after the upstream 0.26.2 replay. `agency_register` and ccstyle Agent badge rows work again; `renderAgentName` prefers a `general-purpose` run's own name. Upstream `0.26.2` get/list/workflow RPC behavior is unchanged.
