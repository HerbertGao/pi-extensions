---
"@herbertgao/pi-agency": patch
"@herbertgao/pi-cc-extensions": patch
"@herbertgao/pi-subagents": patch
"@herbertgao/pi-extensions": patch
---

Label an `Agent` run by identity: a registered type (Code Reviewer) keeps its type name while a named generic run shows its own `name`, in both the ccstyle transcript row and the pi-subagents badges. The `name` parameter accepts any characters — labels show it as given, `@handles` are slugged. `agency_register` seats catalog personas as session-scoped agent types over the new `subagents:rpc:register-agents` bus channels: the persona body becomes the system prompt, the card name and color become the label and badge, and the types vanish at the next session start without ever shadowing file-loaded agents.
