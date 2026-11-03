# @herbertgao/pi-agency

## 0.1.3

### Patch Changes

- [#346](https://github.com/HerbertGao/pi-extensions/pull/346) [`641894f`](https://github.com/HerbertGao/pi-extensions/commit/641894ff5dc34a38ab41905f27a3077cc865ab91) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Document Pi 1.5.0 as the tested host and publish each package changelog so Pi can show Extension Updates after an update. Agency tools and clef keep the same TypeBox schemas, built from typebox because Pi 1.5 no longer re-exports Type. Peer ranges stay open. The BTW fullscreen handoff resolves `@narumitw/pi-tui-kit@0.68.1` inside the existing `^0.68.0` range.

## 0.1.2

### Patch Changes

- [#306](https://github.com/HerbertGao/pi-extensions/pull/306) [`935acc3`](https://github.com/HerbertGao/pi-extensions/commit/935acc38af54c76b6924bb48a0b09d2c59e4997f) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Label a run with its own `name` in the agent widget, the expanded agent block, the fleet list, the conversation header, and the Agent tool row, keeping its type's badge color. `agency_dispatch` now reports per-run duration, tool uses, and tokens in both its text and its structured result, and reports none of them for a run handed off to the background.

## 0.1.1

### Patch Changes

- [#287](https://github.com/HerbertGao/pi-extensions/pull/287) [`3a0deb9`](https://github.com/HerbertGao/pi-extensions/commit/3a0deb96297aa6da94fe40724a3945ef16c34497) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Stop bundling resume-from and lower the Node engines floor to `>=22.19.0`, matching Pi. Node 24 was copied from resume-from's engines field; these packages do not use a Node 24-only API. Pi's bundled Node 22 can install the current release instead of silently selecting an older one.
