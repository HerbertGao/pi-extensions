# @herbertgao/sol-pi

## 0.3.2

### Patch Changes

- [#232](https://github.com/HerbertGao/pi-extensions/pull/232) [`9c3c40f`](https://github.com/HerbertGao/pi-extensions/commit/9c3c40f113c62437f76d300042fc59fbf15954c0) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Require the unified Pi 0.87.1 dependency line across published packages.

## 0.3.1

### Patch Changes

- [#219](https://github.com/HerbertGao/pi-extensions/pull/219) [`6525a59`](https://github.com/HerbertGao/pi-extensions/commit/6525a5995b8bb815517e326f1eef78d25c0a3c5e) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Bundle `pi-multi-account@1.22.0` for automatic multi-account failover and rotation across supported Pi providers. Update the aggregate host to Pi 0.85.1 and widen the maintained child package compatibility ranges.

## 0.3.0

### Minor Changes

- [#200](https://github.com/HerbertGao/pi-extensions/pull/200) [`8b8673c`](https://github.com/HerbertGao/pi-extensions/commit/8b8673c5fc802427ab04419de7e13750f0db6ce2) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Remove the bundled `@czottmann/pi-automode` dependency.

  Auto mode's enable/disable override lived only in the main session's entry stream, so a subagent session restored no override and fell back to the persisted disk default. Subagents therefore stayed subject to automode interception even after the main session disabled it, and its `permissions.ask` rules hard-blocked inside subagents because `ctx.hasUI` is false there. Removing the companion drops that guardrail entirely instead of propagating a session-scoped toggle across sessions.

  - Drop `@czottmann/pi-automode` from aggregate dependencies, bundled dependencies, Pi extension entries, and Pi skill entries; remove its pin from `upstreams.json`.
  - Remove the auto-mode real-Pi smoke and the aggregate assertions that verified its bundled manifest, license, extension entry, skills, status key, and `automode_inspect` registration.
  - Restore SoL-Pi Action Fusion to its upstream form by removing the local `automode_inspect` guard, which existed only to defer nested `then_run` authorization to automode. The extension-owned `write` guard is unrelated to automode and is retained.
  - Remove the bundled `examples/pi-footer.json` layout example and its aggregate verification, along with the Auto mode footer status row.

## 0.2.0

### Minor Changes

- [#164](https://github.com/HerbertGao/pi-extensions/pull/164) [`52558be`](https://github.com/HerbertGao/pi-extensions/commit/52558be6f06659cb9354b8d80a1e9321c35acbcb) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Import the MIT-licensed NVlabs/SoL-Pi efficiency mechanisms as a maintained package with upstream provenance, with guards for extension-owned writes, pi-automode, and active subagents.

### Patch Changes

- [#177](https://github.com/HerbertGao/pi-extensions/pull/177) [`ceeece0`](https://github.com/HerbertGao/pi-extensions/commit/ceeece0b2db2ff962eec513a0b7f766471743057) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Sync the SoL-Pi Action Fusion file-URL resolution fix and its regression coverage from NVlabs/SoL-Pi.
