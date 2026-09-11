# @herbertgao/pi-cc-extensions

## 0.9.0

### Minor Changes

- [#150](https://github.com/HerbertGao/pi-extensions/pull/150) [`76c6af7`](https://github.com/HerbertGao/pi-extensions/commit/76c6af71d1bd5c99a1ab38a8f37e6daaf10418fa) Thanks [@github-actions](https://github.com/apps/github-actions)! - Port `pi-cc-extensions` 0.8.69: separate `expandedInputMaxLines` (default 5) and `expandedOutputMaxLines` (default 10) config fields so tool card Input and Output sections can be capped independently; the show-more "… +N more lines • click to show more" hint moves to the truncated tail line instead of the section header; double-click collapse now uses a mouseup-arm/unarm pattern to prevent terminals that emit synthetic press events from misidentifying a single click as a double click; Pi 0.85's official "Jump to latest" overlay is suppressed when the local scroll-to-bottom button is active to avoid two overlapping controls. Advance companion `@narumitw/pi-btw` pin to 0.57.0 (adds a themed, clickable Jump to latest control).

## 0.8.60

### Patch Changes

- [#132](https://github.com/HerbertGao/pi-extensions/pull/132) [`e873d36`](https://github.com/HerbertGao/pi-extensions/commit/e873d36513deb902028faa0bf095641a57cb2ae4) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Advance reviewed pi-cc-extensions provenance through 0.8.68 while preserving local viewport clipping, renderer lifecycle, Markdown, mouse, and rich-diff hardening.

## 0.8.59

### Patch Changes

- [#123](https://github.com/HerbertGao/pi-extensions/pull/123) [`acb79c0`](https://github.com/HerbertGao/pi-extensions/commit/acb79c0f7b0a8a65ec2612cb6ce32c8cca496f96) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Selectively sync pi-cc-extensions 0.8.67 with accurate context accounting, configurable dim thinking text, safer tool animation timing, and PowerShell command recognition.

## 0.8.58

### Patch Changes

- [#116](https://github.com/HerbertGao/pi-extensions/pull/116) [`ecda398`](https://github.com/HerbertGao/pi-extensions/commit/ecda398b9a95212c512d53325c617e485e6ded8d) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Selectively sync pi-cc-extensions through 0.8.66 with a Memory context partition, hoverable context overlays, and a dedicated UI settings tab.

## 0.8.57

### Patch Changes

- [#112](https://github.com/HerbertGao/pi-extensions/pull/112) [`6f11ad0`](https://github.com/HerbertGao/pi-extensions/commit/6f11ad03ccbb6ec186aa508f85a1b1d2cdd81c31) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Isolate message hint hover, unify expanded summary card styling, and keep thinking panels stable across transcript rebuilds.

## 0.8.56

### Patch Changes

- [#89](https://github.com/HerbertGao/pi-extensions/pull/89) [`ed31f65`](https://github.com/HerbertGao/pi-extensions/commit/ed31f65b3c4a8757a1248970b5cea2853ad82342) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Selectively sync pi-cc-extensions through 0.8.63 with bounded thinking previews, renderer caching, separate write diff limits, and safer fullscreen click behavior.

## 0.8.55

### Patch Changes

- [#67](https://github.com/HerbertGao/pi-extensions/pull/67) [`5ec4a6d`](https://github.com/HerbertGao/pi-extensions/commit/5ec4a6dd8c0e1c385363d91ea88e519e92119150) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Selectively sync pi-cc-extensions through 0.8.60, including context token reconciliation, tool-result previews, and multiline Markdown link hitboxes while preserving local renderer patches.

## 0.8.54

### Patch Changes

- [#47](https://github.com/HerbertGao/pi-extensions/pull/47) [`3be5ed4`](https://github.com/HerbertGao/pi-extensions/commit/3be5ed48294b3b5a3306c9562c5ec93f52c13705) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Sync selected pi-cc-extensions 0.8.56 features: optional feature registration, streaming-safe Mermaid rendering, and lightweight admonition blocks.

- [#36](https://github.com/HerbertGao/pi-extensions/pull/36) [`c56fb9e`](https://github.com/HerbertGao/pi-extensions/commit/c56fb9e6a4d426f136a5bf3e909c1e2e7a190ffc) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Use the available terminal width for tool commands and paths instead of pre-truncating summaries to fixed 80% and 96-character limits.

## 0.8.53

### Patch Changes

- [#28](https://github.com/HerbertGao/pi-extensions/pull/28) [`aa7e682`](https://github.com/HerbertGao/pi-extensions/commit/aa7e68296c40b044eefd871f90c8142f0aebea02) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Sync `pi-cc-extensions` with upstream 0.8.54, including the upstream renderer layout, live style-mode reshaping, stable compact-round timing, consistently folded Agent/Task cards, reload-safe mouse state, cleanup-safe compact-thinking coexistence, and focused renderer lifecycle/data-integrity fixes.

## 0.8.52

### Patch Changes

- [#19](https://github.com/HerbertGao/pi-extensions/pull/19) [`e81fd4f`](https://github.com/HerbertGao/pi-extensions/commit/e81fd4f8b840b6af9c7015b5629e50987820764e) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Sync pi-cc-extensions with upstream 0.8.53, including modular fullscreen mouse handling, resume/reload transcript refresh, persistent thinking visibility, updated light/dark themes, and fenced-code-safe circled-number rendering.
