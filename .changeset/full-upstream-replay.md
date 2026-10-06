---
"@herbertgao/pi-cc-extensions": minor
"@herbertgao/sol-pi": minor
"@herbertgao/pi-extensions": minor
---

Replay the locally customized extensions on the latest upstream code while keeping the scoped packages, host-provided Pi SDK, and local rich-diff and Action Fusion compatibility.

- Bring in pi-cc-extensions 0.9.10, including codemode call trees, expanded input highlighting, the persistent expanded-card background setting, and MCP status chips.
- Bring in the latest SoL-Pi mainline, including projection-based compaction economics, cache-debt accounting, compaction-rejection recovery, and temporary evidence archives for non-persistent sessions.
- Keep all four SoL-Pi features opt-in. Temporary evidence archives remain on disk for consumers and require cleanup by the host or caller.
