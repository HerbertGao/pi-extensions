# @herbertgao/pi-extensions

Aggregate installer for HerbertGao-maintained Pi extensions and pinned upstream companions.

## Install

```bash
pi install npm:@herbertgao/pi-extensions
```

Requires Node.js 22.19.0 or newer and Pi 1.2.0 or newer.

## Native MCP

MCP is provided by Pi 0.99.0+, not by a bundled extension. Configure servers in `~/.pi/agent/mcp.json` and use `/mcp` to manage them. Older Pi versions need an upgrade to retain MCP support.

When migrating from `pi-mcp-adapter`, remove any standalone adapter install as well. Native MCP uses `exposure: "direct"` instead of `directTools: true`; tools default to `codemode` exposure. Adapter-only settings such as `lifecycle`, `mcpFooterStatus`, and `showStatusIcon` are not native settings. OAuth servers may require signing in again with `pi mcp login <server>`. See Pi's [MCP documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md).

## Bundled extensions

The package bundles 5 active `@herbertgao/*` child packages—`pi-agency`, `pi-bark`, `pi-cc-extensions`, `pi-subagents`, and `sol-pi`—plus the following upstream packages under their original names:

- `pi-antigravity@0.11.0`
- `pi-provider-qoder@0.6.2`
- `@dietrichgebert/ponytail@5.3.2`
- `@juicesharp/rpiv-ask-user-question@2.13.9`
- `@narumitw/pi-btw@0.62.0`
- `@narumitw/pi-caffeinate@0.49.12`
- `@pi-plugins/fast-mode@0.1.14`
- `@tifan/pi-copy-response@0.2.7`
- `@tifan/pi-handoff@2.2.2`
- `@tifan/pi-inline-skills@1.0.7`
- `@tifan/pi-mermaid-open@0.2.2`
- `@tifan/pi-preferred-thinking@1.0.2`
- `@tifan/pi-recap@0.4.8`
- `@tifan/pi-rename@0.6.0`
- `pi-typesafe@0.10.0`
- `pi-next-cue@1.0.7`
- `pi-lens@4.4.4`
- `pi-web-access@0.44.0`

Pi loads their extensions and skills through `node_modules/` paths inside one package root. The upstream companions are pinned and bundled, not forked or renamed.

The locally customized CC package follows upstream `pi-cc-extensions@1.0.9`; SoL-Pi follows its complete main baseline `e1a586af` with Pi 1.x/codemode compatibility updates through `21956803`. Local behavior not already covered upstream is retained. SoL-Pi's `update_plan` now follows upstream's model-only contract: invoke it directly, not inside codemode scripts. Action Fusion and ccstyle write rich diffs coexist without disabling either feature. All four SoL-Pi features remain opt-in; its new non-persistent-session evidence archives remain on disk for consumers and require host or caller cleanup.

Antigravity `0.11.0` enriches search citations by visiting source sites by default (`ANTIGRAVITY_NO_SOURCE_ENRICH=1` disables enrichment). It refreshes a curated model catalog and upgrades the existing model cache; previously listed model IDs may disappear. Ask `2.13.9` lets other extensions in the same process answer or cancel TUI questionnaires through its event channel, without sender authentication. Web Access `0.44.0` keeps direct tool exposure and `toolActivation: auto` by default. Linkup, DeepSeek search and fetch, provider gateways, `toolActivation: "none"`, deferred exposure, and GCE ADC support require explicit configuration.

Ponytail `5.3.2` updates the Pi skill guidance, including how to turn it off. Its Pi extension entry is unchanged; the new Claude Code band/board hooks are not registered by this aggregate.

### Agency Agents

`@herbertgao/pi-agency` adds `agency_search` and `agency_dispatch` for the [Agency Agents](https://github.com/msitarzewski/agency-agents) catalog cloned at `~/.agency-agents`. Search returns ranked persona cards instead of catalog listings. Dispatch fills persona bodies into subagent prompts outside the main context, runs them as parallel foreground `Agent` calls, and reports each sent prompt's SHA-256. Installing the aggregate does not clone the catalog; see the [package README](../pi-agency/README.md).

### Bark notifications

`@herbertgao/pi-bark` sends localized Bark pushes when a user-facing Pi run fully settles or `@juicesharp/rpiv-ask-user-question` needs an answer. Notifications include emoji-labeled machine/path metadata and support the bundled official Pi badge through Bark's `icon` parameter. Configure it in `$PI_CODING_AGENT_DIR/bark.json` (normally `~/.pi/agent/bark.json`); see the [package README](../pi-bark/README.md). Without a valid endpoint it stays inactive.

`@narumitw/pi-caffeinate@0.49.12` uses the host platform's sleep inhibitor during each Pi agent run. On macOS, `/caffeinate sleep` keeps the system awake while allowing the display to sleep; `/caffeinate display` also keeps the display awake. It releases the inhibitor when the run or session ends. Its D-Bus dependency remains on the normal socket transport under Node; Bun on Linux/macOS can use FFI and an in-process reader thread for Unix file-descriptor transport, falling back when unavailable. No daemon or build step is added.

`clef` asks Cloudflare Clef-flash an on-demand yes/no, choice, or score and prints the questions and answers in the transcript, plus a one-line notice. It is not a permission gate. `pi-typesafe@0.9.1` provides `/typesafe` and `typesafe_evaluate` for explicit structured decisions; `/typesafe enable` or `PI_TYPESAFE_ENABLED=1` is still required for agent tool calls. The Pi extension continues to use the TypeSafe API, not Liquid. The package's programmatic client additionally supports Liquid with its own API key and free or paid models; existing usage accounting now merges writes under a short-lived file lock (up to 200ms synchronous wait under contention).

`@herbertgao/sol-pi` adds opt-in Action Fusion, ObservationPack, Evidence-Preserving Reducer, and Online Context Compact; see its [configuration guide](../sol-pi/docs/configuration.md). `pi-lens@4.4.4` publishes a public LSP config schema, reads user-level custom rule directories (project before user before built-in), normalizes argv-style server entries, downgrades `throw-new-error` to a warning, and counts Docker, JSON, and Jedi servers in idle eviction; language routing and the retained multi-root diagnostic facts are unchanged. It promotes `@ast-grep/cli` to `0.50.0`. `pi-web-access@0.44.0` provides configurable web search and fetch tools; its `toolActivation` defaults to `auto`, choosing eager or dynamic tool activation per model. `toolActivation: "none"` stays opt-in and still requires deferred exposure. It adds structured search/fetch data for codemode and an optional, manually started `pi-web-access-mcp` stdio CLI; installing the aggregate does not start that server. Degoog, Keenable, Ceramic, Linkup, and DeepSeek fetch are explicit-only, excluded from automatic and `all` selection. Provider gateway base URLs are opt-in and are not configured by the aggregate. OpenAI search now defaults to `gpt-6-luna`, results and clone cleanup are scoped per extension instance, and the promoted `@modelcontextprotocol/sdk@^1.32.1` moves the bundle off GHSA-6qxp-vccf-f47h. Perplexity search now uses the Search API's ranked pages and snippets rather than a Sonar-generated answer; requests requiring prose still use Sonar. `pi-antigravity@0.11.0` reads Pi 0.86+ transcript system messages, so Antigravity requests carry Pi's system prompt and tools; it also registers `google_search` and `generate_image` tools that use the signed-in Antigravity account. `pi-provider-qoder@0.6.2` registers the `qoder` and `qoder-cn` model providers. Sign in with `/login qoder` (browser or a personal access token from [qoder.com/account/integrations](https://qoder.com/account/integrations)) or `/login qoder-cn` (token from [qoder.com.cn/account/integrations](https://qoder.com.cn/account/integrations)). `QODER_PERSONAL_ACCESS_TOKEN` and `QODERCN_PERSONAL_ACCESS_TOKEN` log those providers in at startup. `/qoder-usage footer on` replaces the status-bar footer for that session, so leave it off while the pi-cc footer is in use. Preferred Thinking 1.0.2 preserves an explicit subagent `--thinking` choice. Deprecated `@tifan/pi-titlebar-spinner` is no longer bundled; Rename remains the single owner of Herdr tab naming.

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

See the [repository README](https://github.com/HerbertGao/pi-extensions#readme) for the complete package list and provenance.

## License

[MIT](LICENSE). Bundled upstream notices are included in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
