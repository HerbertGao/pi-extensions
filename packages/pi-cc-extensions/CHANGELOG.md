# @herbertgao/pi-cc-extensions

## 0.11.1

### Patch Changes

- [#265](https://github.com/HerbertGao/pi-extensions/pull/265) [`852c350`](https://github.com/HerbertGao/pi-extensions/commit/852c350ae6d29eff97d16d72c93010a43ef899f2) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Selectively port reviewed upstream renderer fixes for unnamed tool definitions, original renderer receivers, per-run thinking expansion, expanded-tool viewport stability, same-round panel protection, and compact expand-hint hover. Preserve local configuration and footer behavior.

## 0.11.0

### Minor Changes

- [#258](https://github.com/HerbertGao/pi-extensions/pull/258) [`4f505b1`](https://github.com/HerbertGao/pi-extensions/commit/4f505b1456c5ea766121ee915f14ad29e48973e7) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Replay the locally customized extensions on the latest upstream code while keeping the scoped packages, host-provided Pi SDK, and local rich-diff and Action Fusion compatibility.

  - Bring in pi-cc-extensions 0.9.10, including codemode call trees, expanded input highlighting, the persistent expanded-card background setting, and MCP status chips.
  - Bring in the latest SoL-Pi mainline, including projection-based compaction economics, cache-debt accounting, compaction-rejection recovery, and temporary evidence archives for non-persistent sessions.
  - Keep all four SoL-Pi features opt-in. Temporary evidence archives remain on disk for consumers and require cleanup by the host or caller.

### Patch Changes

- [#258](https://github.com/HerbertGao/pi-extensions/pull/258) [`4f505b1`](https://github.com/HerbertGao/pi-extensions/commit/4f505b1456c5ea766121ee915f14ad29e48973e7) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Keep ccstyle write rich diffs when Action Fusion owns the write tool. Capture the bounded previous-file metadata inside Pi's mutation queue while retaining fused follow-up commands, file URL paths, and cancellation checks. Expanded edit/write diffs also retain sanitized follow-up command output. Third-party writers without the collaboration hook and custom write operations retain the existing ownership warning and fallback.

## 0.10.0

### Minor Changes

- [#252](https://github.com/HerbertGao/pi-extensions/pull/252) [`056db8f`](https://github.com/HerbertGao/pi-extensions/commit/056db8f9bb2ebadbc6297435d6df67d5da175e8e) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Import upstream pi-cc-extensions 0.9.9 directly and retire the long-lived local fork. Carries eight local fixes on top with their regression tests (session-reference guards, agent discovery, Markdown code protection, write-abort honesty, diff \r/colon-ANSI handling, entry teardown, working-message guards, agent-summary path fallback). Compact mode shows the full collapsed diff card, tool summaries use the width-adaptive viewport, and the configurable footer replaces the pi-footer companion.

## 0.9.7

### Patch Changes

- [#250](https://github.com/HerbertGao/pi-extensions/pull/250) [`e7ae14c`](https://github.com/HerbertGao/pi-extensions/commit/e7ae14c849a03453b5ebd162a25f552f781c4a28) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Port reviewed upstream 0.9.6–0.9.9 fixes: stop the working-message refresh timer on a stale ctx instead of crashing Pi, preserve POSIX path separators, and yield the rich write diff with a one-time notice when another extension owns `write`.

## 0.9.6

### Patch Changes

- [#248](https://github.com/HerbertGao/pi-extensions/pull/248) [`c14c004`](https://github.com/HerbertGao/pi-extensions/commit/c14c0042a8e02862cd6718dd60e4ffb22314165c) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Use Pi 0.99+'s native MCP implementation instead of registering the removed `pi-mcp-adapter`, declare Pi-hosted packages as wildcard peers, update `@tifan/pi-handoff` to 2.2.2 for its Herdr startup retry fix, and pin `pi-typesafe` to 0.8.0.

## 0.9.5

### Patch Changes

- [#232](https://github.com/HerbertGao/pi-extensions/pull/232) [`9c3c40f`](https://github.com/HerbertGao/pi-extensions/commit/9c3c40f113c62437f76d300042fc59fbf15954c0) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Require the unified Pi 0.87.1 dependency line across published packages.

## 0.9.4

### Patch Changes

- [#219](https://github.com/HerbertGao/pi-extensions/pull/219) [`6525a59`](https://github.com/HerbertGao/pi-extensions/commit/6525a5995b8bb815517e326f1eef78d25c0a3c5e) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Bundle `pi-multi-account@1.22.0` for automatic multi-account failover and rotation across supported Pi providers. Update the aggregate host to Pi 0.85.1 and widen the maintained child package compatibility ranges.

## 0.9.3

### Patch Changes

- [#210](https://github.com/HerbertGao/pi-extensions/pull/210) [`fb69760`](https://github.com/HerbertGao/pi-extensions/commit/fb69760aebf11ec94970bd85ca50bd750b4adb5a) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Bundle `pi-typesafe@0.5.0` and `pi-jev-auto-mode@0.4.1`, and raise the aggregate Pi baseline to 0.85.1 for their peer requirements. Broaden the maintained child packages' Pi 0.84/0.85 compatibility ranges so they remain installable in the upgraded aggregate.

## 0.9.2

### Patch Changes

- [#194](https://github.com/HerbertGao/pi-extensions/pull/194) [`36375ab`](https://github.com/HerbertGao/pi-extensions/commit/36375abba98b73b7b49f6ded5f84db8c81c9e1d9) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Prevent session-reference autocomplete and before-agent loading from using an invalidated extension context after session replacement, and preserve current-session references when a cancellable switch is aborted.

- [#196](https://github.com/HerbertGao/pi-extensions/pull/196) [`6eb3639`](https://github.com/HerbertGao/pi-extensions/commit/6eb36392071592619fa3e4a84e12ac4f8f819502) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Sync reviewed upstream companion packages and port `pi-cc-extensions` 0.8.71:

  - Port `pi-cc-extensions` 0.8.71: render Pi omission markers in line-number gutters with `⋮`, omit trailing terminal markers, and restore official fullscreen scroll-to-end button when `/ccstyle off` or on teardown.
  - Advance bundled companion pins:
    - `@dietrichgebert/ponytail@4.10.0`: assets and runtime hooks updates.
    - `@juicesharp/rpiv-ask-user-question@2.10.1`: option list and tab bar view refinements.
    - `@pi-plugins/fast-mode@0.1.12`: schema and match helpers update.
    - `@tifan/pi-copy-response@0.2.7`, `@tifan/pi-inline-skills@1.0.6`, `@tifan/pi-mermaid-open@0.2.1`, `@tifan/pi-preferred-thinking@1.0.2`, `@tifan/pi-recap@0.4.7`: latest bugfixes and compatibility maintenance.
    - `pi-mcp-adapter@2.34.0`: add plugin loaders, auth flow enhancements, and dependency updates.

## 0.9.1

### Patch Changes

- [#182](https://github.com/HerbertGao/pi-extensions/pull/182) [`ab02286`](https://github.com/HerbertGao/pi-extensions/commit/ab022861e15c8549ba947365111aa54b7664cbfa) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Port `pi-cc-extensions` 0.8.70: the rich-diff parser accepts Pi's space-delimited numbered rows only while no hunk header has been seen, so unified hunks keep numeric source content instead of treating it as a gutter, and Pi's blank-number `...` omission rows render as metadata without invented line numbers. Long path summaries are relativized against the tool cwd and middle-truncated so the filename stays visible in single-tool, tool-group, and compact edit/write summaries while keeping live-viewport clipping.

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
