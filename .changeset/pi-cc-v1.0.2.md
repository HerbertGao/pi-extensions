---
"@herbertgao/pi-cc-extensions": patch
"@herbertgao/pi-extensions": patch
---

Replay `@herbertgao/pi-cc-extensions` onto upstream v1.0.2 (`3c9ec53`). Take the absorbed agent-directory and fence fixes, the merged live-rate and sticky-click fixes, and the tool-renderer split. A click on the sticky bar's scrollbar track no longer jumps to the top. Keep the scoped package identity and Action Fusion write-diff cooperation. Drop the old-Pi shell duration fallback and the unused local guards. The workspace host is Pi 1.2.0. Session and subagent references ignore custom `before_agent_start` events, and the bundled themes use the published theme schema. No installed configuration, credentials, or sessions are migrated.
