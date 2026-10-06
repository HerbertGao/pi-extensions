# @herbertgao/pi-extensions

Aggregate installer for HerbertGao-maintained Pi extensions and pinned upstream companions.

## Install

```bash
pi install npm:@herbertgao/pi-extensions
```

Requires Node.js 24 or newer and Pi 1.0.4 or newer.

## Native MCP

MCP is provided by Pi 0.99.0+, not by a bundled extension. Configure servers in `~/.pi/agent/mcp.json` and use `/mcp` to manage them. Older Pi versions need an upgrade to retain MCP support.

When migrating from `pi-mcp-adapter`, remove any standalone adapter install as well. Native MCP uses `exposure: "direct"` instead of `directTools: true`; tools default to `codemode` exposure. Adapter-only settings such as `lifecycle`, `mcpFooterStatus`, and `showStatusIcon` are not native settings. OAuth servers may require signing in again with `pi mcp login <server>`. See Pi's [MCP documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md).

## Bundled extensions

The package bundles 4 active `@herbertgao/*` child packages—`pi-bark`, `pi-cc-extensions`, `pi-subagents`, and `sol-pi`—plus the following upstream packages under their original names:

- `pi-antigravity@0.9.0`
- `@dietrichgebert/ponytail@4.13.0`
- `@juicesharp/rpiv-ask-user-question@2.12.0`
- `@narumitw/pi-btw@0.61.1`
- `@narumitw/pi-caffeinate@0.49.9`
- `@pi-plugins/fast-mode@0.1.13`
- `@tifan/pi-copy-response@0.2.7`
- `@tifan/pi-handoff@2.2.2`
- `@tifan/pi-inline-skills@1.0.6`
- `@tifan/pi-mermaid-open@0.2.1`
- `@tifan/pi-preferred-thinking@1.0.2`
- `@tifan/pi-recap@0.4.7`
- `@tifan/pi-rename@0.6.0`
- `pi-typesafe@0.9.1`
- `pi-multi-account@1.24.0`
- `pi-next-cue@1.0.7`
- `pi-jev-auto-mode@0.5.0`
- `pi-lens@4.3.0`
- `pi-web-access@0.37.0`
- `remote-pi@0.7.0`
- `resume-from@0.4.1`

Pi loads their extensions and skills through `node_modules/` paths inside one package root. The upstream companions are pinned and bundled, not forked or renamed.

The local `@herbertgao/resume-from` fork is retired. If it is installed separately, remove that package before upgrading the aggregate to avoid registering `/resume-from` twice. The aggregate now uses upstream `resume-from@0.4.1`; its v0.4.0 start-directory fix supersedes our local patch.

The locally customized CC and SoL-Pi packages now follow complete upstream baselines `pi-cc-extensions@0.9.10` and SoL-Pi main `e1a586af`, with local behavior replayed on top. Action Fusion and ccstyle write rich diffs coexist without disabling either feature. All four SoL-Pi features remain opt-in; its new non-persistent-session evidence archives remain on disk for consumers and require host or caller cleanup.

### Bark notifications

`@herbertgao/pi-bark` sends localized Bark pushes when a user-facing Pi run fully settles or `@juicesharp/rpiv-ask-user-question` needs an answer. Notifications include emoji-labeled machine/path metadata and support the bundled official Pi badge through Bark's `icon` parameter. Configure it in `$PI_CODING_AGENT_DIR/bark.json` (normally `~/.pi/agent/bark.json`); see the [package README](../pi-bark/README.md). Without a valid endpoint it stays inactive.

`@narumitw/pi-caffeinate@0.49.9` uses the host platform's sleep inhibitor during each Pi agent run. On macOS, `/caffeinate sleep` keeps the system awake while allowing the display to sleep; `/caffeinate display` also keeps the display awake. It releases the inhibitor when the run or session ends. Its D-Bus dependency remains on the normal socket transport under Node; Bun on Linux/macOS can use FFI and an in-process reader thread for Unix file-descriptor transport, falling back when unavailable. No daemon or build step is added.

`pi-jev-auto-mode@0.5.0` adds fail-closed Jev safety gates for shell commands and file changes. `pi-typesafe@0.9.1` provides `/typesafe` and `typesafe_evaluate` for explicit structured decisions; `/typesafe enable` or `PI_TYPESAFE_ENABLED=1` is still required for agent tool calls. The Pi extension continues to use the TypeSafe API, not Liquid. The package's programmatic client additionally supports Liquid with its own API key and free or paid models; existing usage accounting now merges writes under a short-lived file lock (up to 200ms synchronous wait under contention).

`resume-from@0.4.1` continues sessions across Pi, Claude Code, and Codex; it keeps a Claude Code session matched to its start directory when the active transcript later moves into a nested cwd. `@herbertgao/sol-pi` adds opt-in Action Fusion, ObservationPack, Evidence-Preserving Reducer, and Online Context Compact; see its [configuration guide](../sol-pi/docs/configuration.md). `pi-lens@4.3.0` expands language routing and bounds retained diagnostic facts across multi-root sessions. `pi-web-access@0.37.0` provides configurable web search and fetch tools; its `toolActivation` defaults to `auto`, choosing eager or dynamic tool activation per model. It adds structured search/fetch data for codemode and an optional, manually started `pi-web-access-mcp` stdio CLI; installing the aggregate does not start that server. Degoog and Keenable are explicit-only providers, excluded from automatic and `all` selection. Perplexity search now uses the Search API's ranked pages and snippets rather than a Sonar-generated answer; requests requiring prose still use Sonar. `pi-antigravity@0.9.0` reads Pi 0.86+ transcript system messages, so Antigravity requests carry Pi's system prompt and tools; it also registers `google_search` and `generate_image` tools that use the signed-in Antigravity account. Preferred Thinking 1.0.2 preserves an explicit subagent `--thinking` choice. Deprecated `@tifan/pi-titlebar-spinner` is no longer bundled; Rename remains the single owner of Herdr tab naming.

`pi-stash` is no longer bundled: `/btw` already preserves the main editor draft while handling side questions outside the main conversation. Prior `@herbertgao/pi-stash` releases remain available but are no longer maintained here.

### Next-cue suggestions

`pi-next-cue@1.0.7` predicts a short next prompt after each completed agent turn. In the empty editor, `Tab` fills the suggestion and `Enter` sends it. Each settled turn can make one extra model request using recent conversation text, recent tool names/results, and the configured active or explicitly selected model. It is TUI-only and wraps the prompt editor, so do not enable another custom-editor extension that also owns the editor slot.

### Footer

The configurable status bar is provided by `@herbertgao/pi-cc-extensions` and enabled by default (`/ccstyle` → Footer page: chips, lines, ordering, plain-text icons). `pi-footer` is no longer bundled. If `pi-footer` was installed separately, remove it so only one footer extension owns the status bar; a leftover `$PI_CODING_AGENT_DIR/extensions/pi-footer.json` can be deleted.

For the intended compact status text, merge the optional pi-lens widget setting into its existing file rather than replacing the file:

```jsonc
// ~/.pi-lens/config.json
{
  "widget": {
    "visible": false,
  },
}
```

Pi 0.85.1 or newer should use native `fullscreen` TUI mode.

### Remote Pi trust boundary

Configure `REMOTE_PI_RELAY` to a private relay, preferably reachable only through Tailscale or another private network, **before** first running `/remote-pi`. TLS/Tailscale protects traffic in transit but the relay process can read routed content; `remote-pi@0.7.0` is not end-to-end encrypted.

Known accepted `0.7.0` limitations: pairing URI/token data is persisted in Pi session data and may enter model context during its short validity window; local broker/supervisor IPC trusts processes running as the same OS user; cancelling first-time setup can retain its cwd lock until Pi exits. Do not use the public relay or run untrusted local processes if those boundaries are unacceptable.

See the [repository README](https://github.com/HerbertGao/pi-extensions#readme) for the complete package list and provenance.

## License

[MIT](LICENSE). Bundled upstream notices are included in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
