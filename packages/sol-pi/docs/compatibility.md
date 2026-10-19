# Pi Compatibility

This monorepo tests `@herbertgao/sol-pi` against the root development host Pi 1.2.0. Pi runtime peers remain `*`, so Pi owns installation and upgrades; that range is not a guarantee for every host. Upstream reports a 19-file/140-test suite and offline startup passing on 0.85.1 and 0.84.2, with earlier public-API checks on the 0.81.1 fork. Those are historical upstream results, not results for the locally adapted package. Its tests use Pi 1.x `ExtensionToolContext` for tool execution.

SoL-Pi imports only public package exports:

- `createEditToolDefinition`
- `createWriteToolDefinition`
- `createBashToolDefinition`
- extension types and `ExtensionAPI.registerTool`
- `context`, `before_provider_request`, `tool_result`, `turn_end`, `agent_settled`, and `session_before_tree` extension events
- native compaction events, `ExtensionContext.getContextUsage()`, and `ExtensionContext.compact()`
- `ExtensionContext.model` and `ExtensionContext.modelRegistry`
- the public session-manager methods exposed through `ExtensionContext`
- `SettingsManager` for trusted file-backed shell settings
- feature-detected `ExtensionAPI.getSettings()` and `buildSessionProjection()` on Pi 1.x
- tool `exposure` for model-only `update_plan` calls

## Action Fusion

The built-in edit/write definitions capture their working directory, so SoL-Pi caches one definition per `ctx.cwd`. Its own per-file queue surrounds the built-in mutation and follow-up command. It does not nest Pi's built-in mutation queue.

Action Fusion decodes `file://` targets with Node's `fileURLToPath()` before resolving the queue and hash-check path. This keeps file URLs, including percent-encoded filenames and Pi's optional `@` prefix, aligned with the file handled by the built-in mutation tool.

On Windows it applies the same drive-path conversion Pi's own resolver applies, so Git Bash, MSYS, Cygwin, and WSL targets such as `/c/src/app.ts` and home-relative `~\` paths resolve to the file the built-in mutation tool wrote. On other platforms those inputs keep their POSIX meaning.

The queue covers only fused operations registered by this SoL-Pi instance. External processes, direct built-in-tool calls outside the replacement, and unrelated extensions are not globally locked. SoL-Pi hashes the target immediately before launching `then_run` and skips the command if it observes an intervening content change.

When another extension already owns `write`, Action Fusion leaves that tool in place and only registers its `edit` replacement.

A native local `write` exposes the runtime-only `Symbol.for("herbertgao.pi.writeMetadataObserver")` annotation. CC-style rendering can register bounded previous-file capture inside Pi's native `WriteOperations.writeFile` mutation queue, rather than racing a `tool_call` hook. Custom write operations reject registration because they may not target the local filesystem. Cancellation during capture prevents the actual write. This annotation adds no runtime dependency or global observer state.

Pi 1.x may return `Bash.isError` instead of throwing on a failed follow-up. Action Fusion reports that failure while retaining the successful mutation.

## ObservationPack

ObservationPack changes only the messages projected through the public `context` event. Pi passes `context` handlers a cloned copy of the conversation, so stored session history remains intact. ObservationPack replaces the content of those message objects in place and returns nothing. Since Pi 0.87, a handler that returns different message objects makes Pi merge every mid-conversation system message, such as prompt sections and tool-declaration deltas, into one leading system message, which breaks the provider's cached prefix on every later request. The in-place edit keeps those messages where they are on Pi 1.x and behaves the same on Pi 0.84.2.

Original bytes and the JSONL ledger live under the session-derived SoL-Pi directory.

## Evidence-Preserving Reducer

The reducer handles public `tool_result` events and resolves the configured reducer provider/model through Pi's model registry before calling `ExtensionContext.modelRegistry.complete()` when available. For the Pi 0.81.1 fork, which exposes no registry `complete()` method, it resolves authentication for that reducer model through `getApiKeyAndHeaders()` and calls the shared `@earendil-works/pi-ai/compat` completion API. The reducer preserves the original result whenever the configured reducer model is unavailable or eligibility, model-call, schema, source-hash, exact-quote, size, or likely-secret checks fail.

All persistent paths use `SessionManager.getSessionDir()` and `getSessionId()`, which are present in both the fork and Pi 0.85.1. If the session directory is empty (`--no-session` or `SessionManager.inMemory()`), SoL-Pi lazily creates a private `sol-pi-<session-id>-<random>/` directory under `os.tmpdir()`. Its path is reused by session ID across contexts and both archiving mechanisms while the extension is loaded. These files remain available after worker shutdown for callers that need to read evidence; cleanup is left to the host or caller. SoL-Pi creates no configurable storage-path surface.

The unpublished shared artifact layout is not read or migrated. Each persistent session starts from its own `<sessionDir>/sol-pi/<sessionId>/` directory; ephemeral sessions use the temporary fallback above.

## Online Context Compact

Online Context Compact uses ordinary public `context` and `before_provider_request` handlers instead of fork-only post-transform observer methods. Public handlers run in extension load order, so the SoL-Pi entrypoint registers Online Context Compact after its other context transformers. A third-party transformer loaded later is outside the context-growth observation used by its estimate.

Before selecting or executing a boundary compaction, it also checks the optional `Symbol.for("pi-subagents:manager")` registry exposed by `pi-subagents`. A running top-level subagent, or an unreadable registry, suppresses that compaction rather than risking a context rewrite during delegated work. When the registry is absent, the check is a no-op.

The native cut is estimated from Pi's canonical session projection when available (Pi 1.x), and from raw session entries on Pi 0.84.2. Removable-token savings are measured from corresponding messages in the latest observed extension projection. ObservationPack placeholders are therefore priced at their projected size, context edits are applied before choosing the cut, and retained system checkpoints are excluded from savings. Dropped messages, unseen additions, and ambiguous matches contribute no proven savings; the estimator never substitutes their raw byte counts or reruns context hooks. Pi's special recovery-omission suffix can allow a larger removable prefix than the public cut-point helper predicts; OCC conservatively underestimates savings in that case.

Compaction preserves the current plan, request-horizon samples, and context-growth history. Every plan update uses the same step-ID/status comparison, including the first update after compaction. A boundary requires a previously registered unfinished step to become completed. Newly introduced completed IDs establish history without creating a boundary, so re-keyed completed snapshots do not retrigger compaction. An assistant must register a step before completing it to make that completion eligible for OCC. Economic compaction has a two-provider-request cooldown; context-window protection can override it. A new user task following a fully completed plan resets the request-horizon samples while preserving unpaid cache debt.

On Pi builds whose `ExtensionAPI` has `getSettings()` (1.0.x), Online Context Compact reads Pi's effective `compaction.keepRecentTokens` and `compaction.reserveTokens`. A per-model `compaction.modelOverrides["<provider>/<id>"]` entry for the current `ctx.model` takes precedence, as in Pi. The reserve is used for window-pressure protection. On Pi 0.84.2 it uses the documented defaults of 20,000 retained-tail tokens and a 16,384-token reserve. An explicit `keepRecentTokens` passed to the programmatic factory overrides the retained tail on every version.

Pi 0.85.1's `ExtensionContext.compact()` aborts the active agent before it summarizes, and `agent_settled` fires only once a whole run has drained every turn, retry, auto-compaction, and queued continuation. A plan boundary that selects compaction therefore saves its plan and progress state, calls `ExtensionContext.abort()` to stop the run, and runs compaction from the `agent_settled` that stop produces. The handler awaits the compaction's own `onComplete`/`onError` callbacks. On success, the extension sends a hidden reminder through public `ExtensionAPI.sendMessage()` with `triggerTurn: true`, so Pi starts a new turn against the compacted context and continues the current plan. The reminder asks it to preserve existing step IDs when updating progress; an immediate plan update is not required.

A settlement barrier keeps the original `agent_settled` dispatch open until a synchronously triggered continuation settles. Print- and JSON-mode processes therefore complete the compact-and-continue sequence within the same Pi invocation; an outer driver does not need to resume the session or send `Continue working`. Successful compaction schedules a continuation. The exact native refusals `Nothing to compact (session too small)` and `Already compacted`, and Pi's explicit incomplete-summary token-cap error, also resume the interrupted task with the existing context. These skips are recorded as `sol-pi-online-context-compact-skipped` entries and shown as TUI warnings; they do not record a compaction or charge new cache debt. Plan-only turns cannot retry compaction until successful non-plan tool work or new user input occurs. Cancelling or exiting does not schedule a continuation. Other non-cancellation compaction errors schedule a hidden continuation before the failure propagates.

Pi 0.85.1 does not return a promise from `ExtensionAPI.sendMessage()` and starts the requested turn synchronously, so it uses the extension's settlement barrier. Newer hosts can keep the context idle and defer the turn until settled handlers return; OCC returns control to such a host instead of waiting on the deferred turn or reporting a false start failure. A later-loaded third-party extension that performs long asynchronous work in its own `agent_settled` handler needs an integration test with that extension set.

For reasoning models, native compaction temporarily lowers high/xhigh/max thinking to medium to leave output budget for summary text, then restores it if no one else changed it.

Pi reports the session as idle while an extension-requested manual compaction is running. SoL-Pi cancels `session_before_tree` during that interval to prevent tree navigation from moving the active leaf underneath the compaction. Navigation works normally after the compaction callback settles.

Online Context Compact reads `ExtensionContext.getContextUsage()` for both the context window and the provider-counted context size. When Pi reports no size — as it does between a compaction and the next answered request — the boundary falls back to its own estimate.

The standalone entry passes `cacheWriteReadRatio` from `sol-pi.json` directly into Online Context Compact's economic check. It does not inspect model price metadata. Changing models during a session does not change the ratio; users who want a different decision policy update the configuration and start a new session.

## Codemode

Pi 1.x codemode lets the model run a script that calls other tools through `ctx.executeTool()`. With `codemode.mode: "on"`, declared tools stay declared and are also callable from scripts. With `"only"`, they are hidden from the model and listed in the `codemode` tool description instead. Calls made from a script get the id `<codemode call id>/<n>`, and their results reach only the script, not the transcript. Every mechanism loads and runs in both modes:

| Mechanism | `codemode.mode: "on"` | `codemode.mode: "only"` |
|---|---|---|
| Action Fusion | Fused edit/write stay declared to the model and are also callable from scripts. | Fused edit/write are callable from scripts only. |
| ObservationPack | Large text results of direct tools and of `codemode` itself are packed. `obs_recall` is declared directly and callable from scripts. | `codemode` results are packed. `obs_recall` is listed in the `codemode` description and callable from scripts. |
| Evidence-Preserving Reducer | Reduces direct bash and fused edit/write results as before. Script calls are skipped. | No effect in normal operation: the model reaches bash, edit, and write through scripts, and script calls are skipped. It makes no model calls. |
| Online Context Compact | `update_plan` stays declared to the model and is not callable from scripts. | Same as `"on"`. |

**Action Fusion.** Scripts call `tools.edit` and `tools.write`; the `then_run` parameter appears in their script declarations. Edit and write declare no output schema, so following codemode's rule a successful call resolves to the combined text, including `[then_run:succeeded]` and the command output. A failed command (`[then_run:failed]`) or a failed mutation (`[then_run:skipped]`) rejects with an `Error` whose message holds that text. The file change is kept, so scripts that run `then_run` should use `try`/`catch` or `Promise.allSettled()`. Codemode lists script calls inside its own TUI row, so they show neither the Action Fusion banner nor the savings notice: a script already chains tools inside one model request.

**ObservationPack.** A `codemode` result is an ordinary tool result. Successful text-only results over 10 KiB are sent in full for two provider requests and then replaced by a placeholder naming `tool: codemode`. Tool calls made inside a script are not in the transcript and are never packed; only the script's output is. `tools.obs_recall({ id, offset })` resolves to the recall text, a header followed by the original bytes. The placeholder still says to call `obs_recall`; its wording is unchanged so placeholder bytes stay stable.

**Evidence-Preserving Reducer.** Because script calls are skipped, a script calling `tools.bash` gets Pi's own result: the call resolves to Pi's structured value `{ output, exit_code, truncated, full_output_path?, wall_time_seconds }`, and a non-zero exit resolves rather than rejects. A timeout, an abort, or a missing exit code rejects. The `codemode` result itself is never reduced.

**Online Context Compact.** `update_plan` is registered with exposure `"model-only"`: a script call would get a nested id that no turn reports as a tool result, so its plan boundary could never compact. The model calls `update_plan` directly in both modes, and plan boundaries compact and continue as described above.

## Interactive TUI

The lightning savings treatment uses Pi 0.85.1's public `renderCall`,
`renderResult`, `ctx.ui.notify()`, and keyed `ctx.ui.setStatus()` APIs. It checks
`ctx.mode === "tui"` rather than `ctx.hasUI`, because RPC mode also reports UI
support. The renderer therefore changes only the interactive terminal display;
it does not change session messages, provider requests, tool results, JSON
events, print output, or RPC UI requests.

## Test doubles

The test suite drives every extension through the same public `ExtensionAPI` and `ExtensionContext` surface Pi provides, over a real public `SessionManager`, without calling a remote model provider. That keeps the suite zero-spend and independent of the deleted Pi monorepo test harness. Suites that need a genuine session tree — branch order, compaction entries, custom entries, resume — use `SessionManager.inMemory()` or `SessionManager.create()` rather than reimplementing them.

`tests/pi-package-integration.test.ts` loads the actual TypeScript entrypoint through Pi's `DefaultResourceLoader`, reads a trusted all-enabled project configuration, and executes a fused write/command and a plan update in a real `AgentSession`. `tests/online-context-compact-agent-session.test.ts` verifies one and two consecutive native compactions and waits for automatic continuation before the original prompt returns. These integration tests use Pi's deterministic faux provider; they verify runtime compatibility, not live provider authentication or token savings.

Upstream's historical 0.84.2 backward-compatibility run used an isolated copy of its source and tests, separate dependencies, and an empty Pi agent directory. Only the copy's four Pi development dependency versions, lockfile, and installation-guide version mentions changed. No source or test changes were needed. The run included all four mechanisms and the native compaction/continuation integration tests; it did not repeat live-provider benchmarks on 0.84.2.
