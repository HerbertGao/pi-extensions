---
"@herbertgao/pi-extensions": minor
"@herbertgao/sol-pi": minor
---

Remove the bundled `@czottmann/pi-automode` dependency.

Auto mode's enable/disable override lived only in the main session's entry stream, so a subagent session restored no override and fell back to the persisted disk default. Subagents therefore stayed subject to automode interception even after the main session disabled it, and its `permissions.ask` rules hard-blocked inside subagents because `ctx.hasUI` is false there. Removing the companion drops that guardrail entirely instead of propagating a session-scoped toggle across sessions.

- Drop `@czottmann/pi-automode` from aggregate dependencies, bundled dependencies, Pi extension entries, and Pi skill entries; remove its pin from `upstreams.json`.
- Remove the auto-mode real-Pi smoke and the aggregate assertions that verified its bundled manifest, license, extension entry, skills, status key, and `automode_inspect` registration.
- Restore SoL-Pi Action Fusion to its upstream form by removing the local `automode_inspect` guard, which existed only to defer nested `then_run` authorization to automode. The extension-owned `write` guard is unrelated to automode and is retained.
- Remove the bundled `examples/pi-footer.json` layout example and its aggregate verification, along with the Auto mode footer status row.
