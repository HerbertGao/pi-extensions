# @herbertgao/pi-extensions

## 2026.8.5

### Patch Changes

- [#45](https://github.com/HerbertGao/pi-extensions/pull/45) [`97bad4e`](https://github.com/HerbertGao/pi-extensions/commit/97bad4e05f7398d9910786e8d614ffd4943cac8c) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Link persisted subagent sessions to their parent Pi session and advance the reviewed upstream baseline to 0.15.1.

- [#34](https://github.com/HerbertGao/pi-extensions/pull/34) [`7f7d959`](https://github.com/HerbertGao/pi-extensions/commit/7f7d9591fd61593fde96b5c2ae47db973505dcad) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Avoid registering remote-pi's agent-network skill twice; the extension deploys it to the shared global skill directory.

- [#47](https://github.com/HerbertGao/pi-extensions/pull/47) [`3be5ed4`](https://github.com/HerbertGao/pi-extensions/commit/3be5ed48294b3b5a3306c9562c5ec93f52c13705) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Sync selected pi-cc-extensions 0.8.56 features: optional feature registration, streaming-safe Mermaid rendering, and lightweight admonition blocks.

- [#52](https://github.com/HerbertGao/pi-extensions/pull/52) [`b12ab55`](https://github.com/HerbertGao/pi-extensions/commit/b12ab5597059ff2020e2108f8e8de85ce64e49c7) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Sync the applicable pi-subagents 0.16.0 fixes and advance the reviewed upstream baseline to bcbd602.

- [#53](https://github.com/HerbertGao/pi-extensions/pull/53) [`0227afc`](https://github.com/HerbertGao/pi-extensions/commit/0227afc9c2d253a65a7d3231dcfe6d6b27ce6593) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Update the bundled ask-user-question companion to 2.5.2 and coordinate its rpiv-config range.

- [#44](https://github.com/HerbertGao/pi-extensions/pull/44) [`2b93106`](https://github.com/HerbertGao/pi-extensions/commit/2b931068bc17bfee3b1dabfc9b27f5937743da33) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Update the bundled ask-user-question extension and its rpiv-config dependency to 2.5.0.

- [#43](https://github.com/HerbertGao/pi-extensions/pull/43) [`229cf04`](https://github.com/HerbertGao/pi-extensions/commit/229cf049e7ad777c002291c3e381884d092a78da) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Update the bundled pi-mcp-adapter to 2.25.0.

- [#46](https://github.com/HerbertGao/pi-extensions/pull/46) [`4baef21`](https://github.com/HerbertGao/pi-extensions/commit/4baef2171414910dabd8e6ff252f720f64797455) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Update pi-btw to 0.51.0 and its promoted pi-tui-kit dependency to ^0.54.0 for searchable thread selection.

- [#54](https://github.com/HerbertGao/pi-extensions/pull/54) [`0986a1b`](https://github.com/HerbertGao/pi-extensions/commit/0986a1bd1c62959d614e23914cb34b164320d61a) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Update the bundled pi-lens companion to 4.0.0 and promote its Pi 0.84.1/minimatch runtime ranges.

- Updated dependencies [[`97bad4e`](https://github.com/HerbertGao/pi-extensions/commit/97bad4e05f7398d9910786e8d614ffd4943cac8c), [`3be5ed4`](https://github.com/HerbertGao/pi-extensions/commit/3be5ed48294b3b5a3306c9562c5ec93f52c13705), [`b12ab55`](https://github.com/HerbertGao/pi-extensions/commit/b12ab5597059ff2020e2108f8e8de85ce64e49c7), [`c56fb9e`](https://github.com/HerbertGao/pi-extensions/commit/c56fb9e6a4d426f136a5bf3e909c1e2e7a190ffc)]:
  - @herbertgao/pi-subagents@0.15.4
  - @herbertgao/pi-cc-extensions@0.8.54

## 2026.8.4

### Patch Changes

- [#32](https://github.com/HerbertGao/pi-extensions/pull/32) [`ace86f3`](https://github.com/HerbertGao/pi-extensions/commit/ace86f3634776e6e217f670900a7a26456128f59) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Bundle `pi-footer@0.5.1` and ship a recommended compact layout for MCP, Auto mode, LSP, Ponytail, Remote Pi, and Subagents with a gray dot separator.

## 2026.8.3

### Patch Changes

- [#28](https://github.com/HerbertGao/pi-extensions/pull/28) [`aa7e682`](https://github.com/HerbertGao/pi-extensions/commit/aa7e68296c40b044eefd871f90c8142f0aebea02) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Sync `pi-cc-extensions` with upstream 0.8.54, including the upstream renderer layout, live style-mode reshaping, stable compact-round timing, consistently folded Agent/Task cards, reload-safe mouse state, cleanup-safe compact-thinking coexistence, and focused renderer lifecycle/data-integrity fixes.

- [#27](https://github.com/HerbertGao/pi-extensions/pull/27) [`32bb76c`](https://github.com/HerbertGao/pi-extensions/commit/32bb76c117971de27db9c2b521d19df3ba9ea322) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Keep worktree-isolated agents inside their copy, preserve real Agent tool startup errors, and render unknown or failed Agent results without misleading completion status.

- [#20](https://github.com/HerbertGao/pi-extensions/pull/20) [`c8eb56c`](https://github.com/HerbertGao/pi-extensions/commit/c8eb56cf5b66b1df20b2e879ae6802d99e0edebb) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Update the bundled `pi-web-access` from 0.18.0 to 0.22.0, including bounded external fetched-content storage and the new search and fetch routing options.

- [#26](https://github.com/HerbertGao/pi-extensions/pull/26) [`fabaaaa`](https://github.com/HerbertGao/pi-extensions/commit/fabaaaad0a414039a2958c49e1b61392338e2d37) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Update the bundled `pi-mcp-adapter` from 2.21.2 to 2.23.0, including hardened binary-resource handling and improved OAuth flows for remote and headless environments.

- [#29](https://github.com/HerbertGao/pi-extensions/pull/29) [`8dc9a45`](https://github.com/HerbertGao/pi-extensions/commit/8dc9a45c6844bbc621009d0fa6e75392e657d887) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Bundle `remote-pi@0.7.0` with its Pi extension and agent-network skill for private, self-hosted relay use.

- Updated dependencies [[`aa7e682`](https://github.com/HerbertGao/pi-extensions/commit/aa7e68296c40b044eefd871f90c8142f0aebea02), [`32bb76c`](https://github.com/HerbertGao/pi-extensions/commit/32bb76c117971de27db9c2b521d19df3ba9ea322)]:
  - @herbertgao/pi-cc-extensions@0.8.53
  - @herbertgao/pi-subagents@0.15.3

## 2026.8.2

### Patch Changes

- [#19](https://github.com/HerbertGao/pi-extensions/pull/19) [`e81fd4f`](https://github.com/HerbertGao/pi-extensions/commit/e81fd4f8b840b6af9c7015b5629e50987820764e) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Sync pi-cc-extensions with upstream 0.8.53, including modular fullscreen mouse handling, resume/reload transcript refresh, persistent thinking visibility, updated light/dark themes, and fenced-code-safe circled-number rendering.

- [#14](https://github.com/HerbertGao/pi-extensions/pull/14) [`dffaaa4`](https://github.com/HerbertGao/pi-extensions/commit/dffaaa41bd538f6399971a25890aa40c3ebde0c0) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Update the bundled `pi-mcp-adapter` from 2.19.0 to 2.21.2, including its modular MCP SDK v2 runtime dependencies and `mcpScript` tool naming.

- [#15](https://github.com/HerbertGao/pi-extensions/pull/15) [`bc083d2`](https://github.com/HerbertGao/pi-extensions/commit/bc083d27c974f6b5239561dbd2295b6dd53526c0) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Skip unreadable or malformed custom agent files by default, warn when an earlier same-named definition remains active, and add opt-in strict startup validation.

- [#7](https://github.com/HerbertGao/pi-extensions/pull/7) [`5633ed2`](https://github.com/HerbertGao/pi-extensions/commit/5633ed2585f1feb06201686ae8d83793f1acca18) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Move pi-stash from `Ctrl+S` to `Alt+S` to avoid Pi's built-in `app.models.save` shortcut.

- [#18](https://github.com/HerbertGao/pi-extensions/pull/18) [`d9091c9`](https://github.com/HerbertGao/pi-extensions/commit/d9091c92a57ed3d7f4ec3b3c731215172c005b20) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Bundle `@narumitw/pi-btw` for parallel side questions, `@dietrichgebert/ponytail` for minimal coding modes and maintenance skills, and `@pi-plugins/fast-mode` for priority service-tier requests.

- [#16](https://github.com/HerbertGao/pi-extensions/pull/16) [`7637056`](https://github.com/HerbertGao/pi-extensions/commit/763705614e5c44d3f9d474f92eab15f37595426e) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Update the bundled `@czottmann/pi-automode` from 1.9.0 to 1.11.0, adding opt-in working-directory and denied-path controls, read-only classification, fast-classifier token limits, symlink/path traversal hardening, and correct `/var/home` handling while preserving the existing defaults.

- Updated dependencies [[`e81fd4f`](https://github.com/HerbertGao/pi-extensions/commit/e81fd4f8b840b6af9c7015b5629e50987820764e), [`bc083d2`](https://github.com/HerbertGao/pi-extensions/commit/bc083d27c974f6b5239561dbd2295b6dd53526c0), [`5633ed2`](https://github.com/HerbertGao/pi-extensions/commit/5633ed2585f1feb06201686ae8d83793f1acca18)]:
  - @herbertgao/pi-cc-extensions@0.8.52
  - @herbertgao/pi-subagents@0.15.2
  - @herbertgao/pi-stash@0.1.1
