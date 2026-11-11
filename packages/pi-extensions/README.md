# @herbertgao/pi-extensions

Aggregate installer for HerbertGao-maintained Pi extensions and pinned upstream companions.

## Install

```bash
pi install npm:@herbertgao/pi-extensions
```

Requires Node.js 22.19.0 or newer and Pi 1.5.0 or newer.

## Native MCP

MCP is provided by Pi 0.99.0+, not by a bundled extension. Configure servers in `~/.pi/agent/mcp.json` and use `/mcp` to manage them. Older Pi versions need an upgrade to retain MCP support.

When migrating from `pi-mcp-adapter`, remove any standalone adapter install as well. Native MCP uses `exposure: "direct"` instead of `directTools: true`; tools default to `codemode` exposure. Adapter-only settings such as `lifecycle`, `mcpFooterStatus`, and `showStatusIcon` are not native settings. OAuth servers may require signing in again with `pi mcp login <server>`. See Pi's [MCP documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md).

## Bundled extensions

The package bundles 6 active `@herbertgao/*` child packages—`pi-agency`, `pi-bark`, `pi-cc-extensions`, `pi-impeccable`, `pi-subagents`, and `sol-pi`—plus the following upstream packages under their original names:

- `pi-antigravity@0.12.0`
- `pi-commandcode-provider@0.8.1`
- `pi-provider-qoder@0.6.12`
- `@dietrichgebert/ponytail@5.3.3`
- `@juicesharp/rpiv-ask-user-question@2.15.0`
- `@narumitw/pi-btw@0.63.7`
- `@narumitw/pi-caffeinate@0.49.14`
- `@pi-plugins/fast-mode@0.1.15`
- `@tifan/pi-copy-response@0.2.7`
- `@tifan/pi-handoff@2.2.2`
- `@tifan/pi-mermaid-open@0.2.2`
- `@tifan/pi-recap@0.4.8`
- `@tifan/pi-rename@0.6.0`
- `@tintinweb/pi-tasks@0.9.1`
- `pi-typesafe@0.14.0`
- `pi-next-cue@1.0.8`
- `pi-lens@4.4.12`
- `pi-web-access@0.47.0`

Pi loads their extensions and skills through `node_modules/` paths inside one package root. The upstream companions are pinned and bundled, not forked or renamed.

The locally customized CC package follows upstream `pi-cc-extensions@1.0.16`; SoL-Pi follows its complete main baseline `e1a586af` with Pi 1.x/codemode compatibility updates through `21956803`. Local behavior not already covered upstream is retained. SoL-Pi's `update_plan` now follows upstream's model-only contract: invoke it directly, not inside codemode scripts. Action Fusion and ccstyle write rich diffs coexist without disabling either feature. All four SoL-Pi features remain opt-in; its new non-persistent-session evidence archives remain on disk for consumers and require host or caller cleanup.

Antigravity `0.12.0` enriches search citations by visiting source sites by default (`ANTIGRAVITY_NO_SOURCE_ENRICH=1` disables enrichment). `ANTIGRAVITY_DEFER_TOOLS=1` registers `google_search` and `generate_image` as deferred tools; the default stays direct. A refreshed catalog does not restore a model the current catalog omitted, and an image save rejects a symlink destination. It refreshes a curated model catalog and upgrades the existing model cache; previously listed model IDs may disappear. Ask `2.15.0` lets other extensions in the same process answer or cancel TUI questionnaires through its event channel, without sender authentication. Its notes shortcut defaults to `n` and can be a single non-Latin character; reserved navigation keys stay on `n`. Web Access `0.45.0` keeps direct tool exposure and `toolActivation: auto` by default. Linkup, DeepSeek search and fetch, provider gateways, `toolActivation: "none"`, deferred exposure, GCE ADC, field extraction, 9router, and plain HTTP gateway URLs require explicit configuration. Web Access `0.47.0` adds Sofya and Outcrawl as explicit-only search providers. `lockProxy: true` rejects a tool-call proxy that differs from the configured proxy, including a direct connection. A GitHub repository README is returned up to 100K characters, and a clone with no `githubClone.clonePath` goes under the OS temp directory.

Ponytail `5.3.2` updates the Pi skill guidance, including how to turn it off. Its Pi extension entry is unchanged; the new Claude Code band/board hooks are not registered by this aggregate.

Impeccable `4.8.2` is vendored as `@herbertgao/pi-impeccable` and loaded with `/skill:impeccable`. Its native engine downloads to `~/.impeccable` on first use after SHA-256 verification; set `IMPECCABLE_BIN` for offline or preinstalled setups. The launcher pins engine 0.1.21 and skips a sibling engine binary that reports a different version. Go leaves a staged removal in the page so Undo and Discard can restore it. The package does not install automatic post-edit hooks, and upstream `pin`/`unpin` do not discover npm-loaded skills.

### Agency Agents

`@herbertgao/pi-agency` adds `agency_search` and `agency_dispatch` for the [Agency Agents](https://github.com/msitarzewski/agency-agents) catalog cloned at `~/.agency-agents`. Search returns ranked persona cards instead of catalog listings. Dispatch fills persona bodies into subagent prompts outside the main context, runs them as parallel foreground `Agent` calls, and reports each sent prompt's SHA-256. Installing the aggregate does not clone the catalog; see the [package README](../pi-agency/README.md).

### Bark notifications

`@herbertgao/pi-bark` sends localized Bark pushes when a user-facing Pi run fully settles or `@juicesharp/rpiv-ask-user-question` needs an answer. Notifications include emoji-labeled machine/path metadata and support the bundled official Pi badge through Bark's `icon` parameter. Configure it in `$PI_CODING_AGENT_DIR/bark.json` (normally `~/.pi/agent/bark.json`); see the [package README](../pi-bark/README.md). Without a valid endpoint it stays inactive.

`@narumitw/pi-caffeinate@0.49.14` uses the host platform's sleep inhibitor during each Pi agent run. On macOS, `/caffeinate sleep` keeps the system awake while allowing the display to sleep; `/caffeinate display` also keeps the display awake. It releases the inhibitor when the run or session ends. Its D-Bus dependency remains on the normal socket transport under Node; Bun on Linux/macOS can use FFI and an in-process reader thread for Unix file-descriptor transport, and that thread can be unreferenced so the connection need not keep the process alive. It falls back when FFI is unavailable. No daemon or build step is added. The published extension source is unchanged from 0.49.13 aside from the manifest. It still declares `@narumitw/pi-tui-kit@^0.69.0` and `dbus-native@^0.16.3`. BTW `0.63.7` requires `@narumitw/pi-tui-kit@^0.69.1`, so the aggregate resolves one `0.69.1` install for both.

`@narumitw/pi-btw@0.63.7` opens its side workspace through the `@narumitw/pi-tui-kit@^0.69.1` fullscreen handoff. Fullscreen, menu, and transcript modules load on first use. An already ended session does not open that UI. The loaded flow still stops when the dedicated UI is disposed or the parent terminal cannot be restored. Only one BTW flow can be open per session; a second `/btw` warns and stays closed. In split layout, mounting the first split releases Pi's idle wait so the main input stays usable. Importing new main-thread context stays manual. The main-thread tree picker walks an arbitrarily deep session on the heap, keeps raw copy text as fragments until a copy, and stores a saved label only when the entry has one. Settings rows keep a clipped label or value in full under the list, and a searchable model choice shows how many results match. A searchable choice keeps page scrolling; the host still owns search activation.

`clef` asks Cloudflare Clef-flash an on-demand yes/no, choice, or score and prints the questions and answers in the transcript, plus a one-line notice. It is not a permission gate. `pi-typesafe@0.14.0` provides `/typesafe` and `typesafe_evaluate` for explicit structured decisions; `/typesafe enable` or `PI_TYPESAFE_ENABLED=1` is still required for agent tool calls. The default backend remains `https://api.typesafe.ai`. `PI_TYPESAFE_BACKEND` and `PI_TYPESAFE_MODEL` select the session backend and model, and `/typesafe login` stores a key for the named backend. Only HTTP 401 refuses that key, and only for 15 minutes; a 403 refuses one request and leaves the key usable. Nace.AI (`https://console.nace.ai`, `NACE_API_KEY`, default model `drex-v2.0`) is a judgment backend. Daily request, token, and USD caps are opt-in. OpenRouter, Command Code, Liquid, SubQ, Nace.AI, and a named endpoint stay explicit and use that backend's own key. The promoted SDK is `@typesafe-ai/sdk@0.7.0`. Under Bun, the judge transport reads each response body once and replays it, so the SDK can still read the result after Bun marks the original body used.

`@herbertgao/sol-pi` adds opt-in Action Fusion, ObservationPack, Evidence-Preserving Reducer, and Online Context Compact; see its [configuration guide](../sol-pi/docs/configuration.md). `pi-lens@4.4.12` publishes a public LSP config schema, reads user-level custom rule directories (project before user before built-in), normalizes argv-style server entries, downgrades `throw-new-error` to a warning, and counts Docker, JSON, and Jedi servers in idle eviction; language routing and the retained multi-root diagnostic facts are unchanged. `.mts` and `.cts` use the TypeScript rules. Groovy files still classify as Groovy, and the vendored Groovy grammar lists classes and methods. `--no-read-expansion` turns off read widening without disabling the read-before-edit guard. It promotes `@ast-grep/cli` to `0.51.1` and `@ast-grep/napi` to `^0.51.0`. A blank `PI_LENS_*` number falls back to the default, and an explicit `0` is a value. An edit that raises a named function past the high-complexity threshold and past the default branch names that function on one line; a function the edit improved, or that is still no worse than the default branch, is not named. `ast_grep_replace` no longer requests strict JSON-schema sampling; `lens_diagnostic_mark` still does. A language server for a project outside the session folder starts only when Pi would trust that project. Four MCP tools advertise only `path`. A session rooted at `/` keeps `lsp.disabledServers`. Concatenated SQL passed to `.execute()` is an advisory full-analysis finding; a parameterized `execute(sql, values)` call stays quiet. Keeping injected findings in later requests is opt-in. A workspace edit through a dangling symlink is refused, and a symlink that resolves outside the workspace is refused; the fallback Biome config no longer names a nursery rule. An identity `filter(x => x).map(...)` stays a warning, and a non-identity `filter(fn).map(...)` is no longer flagged. A reduce that copies its accumulator with `Object.assign` is a warning. A directory whose name starts with `..` stays inside its project. `.groovy`, `.gvy`, `.gy`, `.gsh`, `Jenkinsfile`, `build.gradle`, and `settings.gradle` classify as Groovy; `build.gradle.kts` does not. `minimatch` is `^11.0.4` and `vscode-jsonrpc` is `^10.0.0`. `pi-web-access@0.47.0` provides configurable web search and fetch tools; its `toolActivation` defaults to `auto`, choosing eager or dynamic tool activation per model. `toolActivation: "none"` stays opt-in and still requires deferred exposure. Field extraction, 9router, empty or off-topic search fallback, and plain HTTP gateway URLs stay off unless configured. An unknown tool-call provider name fails instead of selecting a provider automatically, and DuckDuckGo searches stay spaced apart after a bot check. It adds structured search/fetch data for codemode and an optional, manually started `pi-web-access-mcp` stdio CLI; installing the aggregate does not start that server. Degoog, Keenable, Ceramic, Linkup, DeepSeek fetch, Cloudflare search, SearchApi, Outcrawl, Sofya, and Tabstack are explicit-only, excluded from automatic and `all` selection. `lockProxy: true` rejects a tool-call proxy other than the configured one. A GitHub repository README is returned up to 100K characters, and a clone with no `githubClone.clonePath` goes under the OS temp directory. Optional `fetchContent.curl` and Exa/Tabstack fetch routing stay off unless configured. Provider gateway base URLs are opt-in and are not configured by the aggregate. OpenAI search now defaults to `gpt-6-luna`, results and clone cleanup are scoped per extension instance, and the promoted `@modelcontextprotocol/sdk@^1.32.1` moves the bundle off GHSA-6qxp-vccf-f47h. Perplexity search now uses the Search API's ranked pages and snippets rather than a Sonar-generated answer; requests requiring prose still use Sonar. `pi-antigravity@0.12.0` reads Pi 0.86+ transcript system messages, so Antigravity requests carry Pi's system prompt and tools; it also registers `google_search` and `generate_image` tools that use the signed-in Antigravity account. Those tools stay direct unless `ANTIGRAVITY_DEFER_TOOLS=1`. A model removed by catalog refresh is not filled back in from the bootstrap list. Image saves reject symlink destinations. The aggregate keeps host `typebox` and `undici@^8.11.2`. `pi-provider-qoder@0.6.12` registers the `qoder` and `qoder-cn` model providers. A tool-call argument stream that is cut off before a usable call is reported as a retryable server error. Startup logs one line when the npm registry has a newer release; `PI_PROVIDER_QODER_SKIP_UPDATE_CHECK=1` skips that lookup. A queued model-busy response reports its wait instead of being ignored; a ready busy response stays retryable. A queued wait that does not fit in a safe millisecond count uses `retryAfterSeconds` instead. Agent chat prefers the account's remote-agent node and, on daily chat limit code 110, tries the next node. The chosen node is cached for one hour. Sign in with `/login qoder` (browser or a personal access token from [qoder.com/account/integrations](https://qoder.com/account/integrations)) or `/login qoder-cn` (token from [qoder.com.cn/account/integrations](https://qoder.com.cn/account/integrations)). `QODER_PERSONAL_ACCESS_TOKEN` and `QODERCN_PERSONAL_ACCESS_TOKEN` log those providers in at startup. `/qoder-usage footer on` replaces the status-bar footer for that session, so leave it off while the pi-cc footer is in use. `pi-commandcode-provider@0.8.1` registers `commandcode` beside `qoder`, `qoder-cn`, and `antigravity`. Inference uses the Provider API only. `/login` lists those subscription providers and runs only the one you select. `@tifan/pi-preferred-thinking` is no longer bundled. Per-model thinking levels come from Pi. Deprecated `@tifan/pi-titlebar-spinner` is no longer bundled; Rename remains the single owner of Herdr tab naming. `@tifan/pi-handoff` imports `@tifan/pi-rename/naming` when it generates a session name, so Rename stays installed and its `/rename` command stays registered.

`pi-stash` is no longer bundled: `/btw` already preserves the main editor draft while handling side questions outside the main conversation. Prior `@herbertgao/pi-stash` releases remain available but are no longer maintained here.

### Next-cue suggestions

`pi-next-cue@1.0.8` predicts a short next prompt after each completed agent turn. Its peer dependency is Pi `>=1.2.0`. In the empty editor, `Tab` fills the suggestion and `Enter` sends it. Each settled turn can make one extra model request using recent conversation text, recent tool names/results, and the configured active or explicitly selected model. It is TUI-only and wraps the prompt editor, so do not enable another custom-editor extension that also owns the editor slot.

### Task lists

`@tintinweb/pi-tasks@0.9.1` adds Claude Code-style task tracking: `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, `TaskExecute`, and `/tasks`. The list is a TUI widget above the editor (`setWidget("tasks", …, { placement: "aboveEditor" })`). It does not call `setEditorComponent` or `setStatus`, so it does not take the prompt editor that `pi-next-cue` wraps and it does not write the pi-cc footer.

Pi stacks widgets by key. While tasks are visible, three other above-editor widgets can show at the same time: `pi-next-cue`'s one-line `hint` (default placement is above the editor), `@herbertgao/pi-subagents`' `agents` list, and pi-cc's empty `compact-thinking-render-loop` hook. The subagents fleet bar stays below the editor. None of these replace the `tasks` widget.

`TaskExecute` needs `@herbertgao/pi-subagents` loaded in the same session. It does not import `@tintinweb/pi-subagents`. It uses the in-process bus (`subagents:rpc:ping`, `spawn`, `stop`, and `consume`) and enables execution only when that bus answers protocol version 2, which this aggregate's subagents fork does. The other task tools, the widget, and `/tasks` work without it. If subagents is missing or the protocol diverges, the tool text still names `@tintinweb/pi-subagents`; that string is upstream copy and is not shown when protocol v2 matches. Peers are `typebox` `*`, `@earendil-works/pi-coding-agent` `>=0.80.5`, and `@earendil-works/pi-tui` `>=0.80.5`, satisfied by the Pi 1.5.0 host. No extra runtime dependency is promoted.

### Command Code

`pi-commandcode-provider@0.8.1` adds the `commandcode` model provider. It does not register its own `/login` command. Pi's `/login` lists it with the other subscription providers (`antigravity`, `qoder`, and `qoder-cn`). Choose **Use a subscription**, then **Command Code**. Press Enter for browser login, type `key` to paste an API key, or paste the key directly. `COMMAND_CODE_API_KEY` signs the provider in at startup. Existing keys in `~/.commandcode/auth.json` are also read. Credentials Pi stores for this provider live under the `commandcode` entry in the host auth file. The reader does not take `qoder` or `antigravity` credentials.

`/commandcode-quota` shows account usage. `/commandcode-refresh` reloads the model catalog, and `/commandcode-status` shows redacted discovery diagnostics: URL userinfo, query strings, and fragments are removed before the shared credential redactor runs. `/commandcode-endpoint` stores a per-model Provider API route, and `/commandcode-diagnostics` prints a content-free report. Inference stays on the Provider API. A `403 upgrade_required` response stops with that requirement and does not retry the retired `/alpha/generate` transport. `COMMANDCODE_TASTE_LEARNING` is no longer read. During a DeepSeek V4 peak window, context-tier rates are doubled together with the base rates, and the host receives its own mutable copy. `/commandcode-refresh` resets the transport probe. On first start without a cache, model discovery waits for `https://api.commandcode.ai/provider/v1/models` and still loads if that request fails. TypeSafe's Command Code judge backend stays opt-in and uses that backend's own key. This aggregate does not also bundle `pi-login-manager` or `@iaziz786/pi-cmd-login`.

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
