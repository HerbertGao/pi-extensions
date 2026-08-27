# Maintenance and release policy

## Repository roles

- [`HerbertGao/pi-extensions`](https://github.com/HerbertGao/pi-extensions) is the independent source and release monorepo.
- [`HerbertGao/tifandotme-pi-extensions`](https://github.com/HerbertGao/tifandotme-pi-extensions) remains the GitHub fork used for Tifan upstream contributions.
- Sibling working repositories are upstream work areas, not package-manager workspaces. Never mutate a dirty sibling while importing it.

## Source baselines

| Local package set      | Upstream                   | Imported baseline                                | Notes                                                                                                                                                         |
| ---------------------- | -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tifan-derived packages | `tifandotme/pi-extensions` | `b39d1e6` (`pi-stash@0.2.0`); reviewed `cca1906` | Only Stash remains locally maintained; eight equivalent packages are bundled directly, and Fixed Editor source was removed.                                   |
| `pi-subagents`         | `tintinweb/pi-subagents`   | `ad81024` (`0.18.2`)                             | The fork preserves warning recovery, runtime compatibility, package identity, parent-session persistence, nested delegation, and local UI surfaces.           |
| `pi-cc-extensions`     | `minuque/pi-cc-extensions` | `bc58504` (`0.8.67`)                             | Selectively tracks the release while preserving local terminal-width, Markdown fence, mouse-slot, renderer-lifecycle, message hardening, and rich-diff fixes. |
| `resume-from`          | `alexei-led/resume-from`   | `e1dad0d` (`0.2.0`)                              | Preserves the original session repository when Claude Code's active transcript later moves into a nested working directory.                                   |

Record a new upstream commit in this table whenever a sync is accepted. Each derived package also carries canonical `x-upstream` metadata in its own `package.json`:

| Local package                  | Upstream package          | Imported version | Imported commit |
| ------------------------------ | ------------------------- | ---------------- | --------------- |
| `@herbertgao/pi-cc-extensions` | `pi-cc-extensions`        | `0.8.67`         | `bc58504`       |
| `@herbertgao/resume-from`      | `resume-from`             | `0.2.0`          | `e1dad0d`       |
| `@herbertgao/pi-stash`         | `@tifan/pi-stash`         | `0.2.0`          | `b39d1e6`       |
| `@herbertgao/pi-subagents`     | `@tintinweb/pi-subagents` | `0.18.2`         | `ad81024`       |

`upstreams.json` records repository review cursors and original-name companion repositories. `scripts/check-upstreams.mjs` validates these records, checks npm latest versions and GitHub default-branch commits, and powers the daily `Upstream Monitor` workflow. For npm release changes, the workflow updates the open upstream-tracking Issue with the matching title, or creates a new Issue when no matching open Issue exists. Unreleased commits remain visible in the workflow summary without opening an Issue. Query errors fail the workflow without changing the Issue state.

### Direct Tifan package migration

After review through `cca1906`, the aggregate stopped republishing eight packages whose maintained behavior no longer justified a parallel source copy. It now pins and bundles these original packages directly: copy-response `0.2.6`, handoff `2.0.1`, inline-skills `1.0.5`, Mermaid Open `0.2.0`, Preferred Thinking `1.0.0`, Recap `0.4.5`, Rename `0.5.1`, and Titlebar Spinner `0.1.3`.

Normalized package comparisons established that copy-response, inline-skills, Mermaid Open, and Titlebar Spinner were source-identical; Preferred Thinking's upstream invalid-JSON error is more precise; Recap and Rename already catch malformed config at their outer initialization boundary; and Handoff differs only in its rename-package namespace. Handoff and Rename therefore move together, while the aggregate continues to provide `typebox`, which Handoff imports at runtime. Rename's malformed Herdr response now produces the upstream warning during an explicit rename instead of being treated as unavailable; session naming still succeeds, and startup recovery remains quiet.

The nine redundant local package sources, including Fixed Editor, are removed without compatibility wrappers; prior npm releases remain outside this repository's maintained package set. Stash remains forked because its local `Alt+S` binding avoids the upstream `Ctrl+S` conflict with Pi.

### Tifan pi-rename 0.5.1 review

The range `08ecbf7..cca1906` affects only `pi-rename`:

- `7ff6d08` is **ported**: session startup now recognizes a launcher-provided temporary Herdr label through `HERDR_TEMPORARY_LABEL` instead of guessing from the current working directory. The focused environment-variable regression test is included, while local malformed Herdr JSON recovery remains intact.
- `cca1906` is release metadata and is represented through local provenance rather than copied workspace metadata.

No other imported Tifan package changed. Package provenance and the repository review cursor advance to released `@tifan/pi-rename@0.5.1` at `cca1906`.

### Tifan release review through 08ecbf7

The range `efc30c3..08ecbf7` and the matching published tags were reviewed package by package:

- `pi-handoff@2.0.1` was **ported** with the intentional `-handoff` prompt marker, generated handoff artifact, clean-session bridge, and shared completion helper; at that review point the local import used `@herbertgao/pi-rename`.
- `pi-mermaid-open@0.2.0` is **ported** now that the release reads Pi's effective Mermaid mode/output padding, distinguishes disabled, unsupported, too-wide, warning, and `mmd` cases, carries a runnable status regression test, and adds the Herdr overlay fallback. Its status explicitly describes Pi's native renderer; the aggregate's separate `pi-cc-extensions` Markdown enhancement remains additive.
- `pi-preferred-thinking@1.0.0` is **ported** with its intentional migration to Pi 0.84.2 native per-model thinking pins in `enabledModels`; the old private config is no longer read.
- `pi-recap@0.4.5` and `pi-rename@0.5.0` are **ported** with Pi 0.84.2 model-registry APIs, loading UI, and Herdr pane/tab synchronization; local malformed-JSON/Herdr-output fallbacks remain preserved where still applicable.
- `pi-stash@0.2.0` contains documentation/release metadata only. Provenance advances while the local Alt+S shortcut fix remains intact instead of restoring the upstream Ctrl+S conflict.
- `pi-review` is a new optional product rather than an update to an imported package. It is reviewed but **not imported**: adding another aggregate extension is outside this maintenance issue and has no existing local compatibility contract.

The repository review cursor advances to `08ecbf7`; documentation-only commits after the published tags do not change package provenance.

### pi-cc-extensions 0.8.67 and post-release review

The released range `e971a39..bc58504` was reviewed commit by commit:

- `c5424bf` is **selectively ported**: `/context` deducts only Memory and Skills content actually embedded in the system prompt, while retaining this fork's detailed user, assistant, tool-result, and compaction partitions plus scrollable previews.
- `25d204c` and `a29c4ea` are **selectively ported**: tool animations start only after execution begins, while restored entries remain static and input summaries keep the fork's viewport-aware clipping instead of adopting a fixed width.
- `fad2062` is **ported**: `dimThinkingText` can render compact thinking with the dim theme color.
- `bc58504` is release metadata and is represented through local provenance.

In the post-release range `bc58504..dba37e5`, PowerShell is recognized as a shell command in agent summaries. Upstream test consolidation is not copied, and the global dock-flush prototype patch is **deferred** because it does not restore the original method during extension shutdown or reload. Package provenance advances to released `v0.8.67` at `bc58504`; the repository review cursor advances through `dba37e5`.

### pi-cc-extensions 0.8.66 review

The released range `4709081..e971a39` was reviewed commit by commit:

- `e1345b0` is **selectively ported**: `/context` exposes context files as a fixed Memory partition and restores fullscreen mouse motion for hoverable context overlays, while retaining this fork's more granular Skills, user/assistant, tool-result, and compaction breakdown plus its scrollable text preview.
- `7890bb3` is **ported**: `/ccstyle` moves startup-header and wheel-step controls into a dedicated UI tab.
- `402341b` and `e971a39` are release metadata only and are represented through local provenance rather than copied manifests or lockfiles.

The fork continues to preserve its renderer-first compact-thinking lifecycle bridge, message-display hardening, live mouse TUI slot, terminal-width handling, Markdown fence/inline protection, compact-thinking coexistence, rich diff ANSI/CRLF/write metadata, and dedicated Agent renderer. Package provenance and the repository review cursor advance to released `v0.8.66` at `e971a39`.

### pi-cc-extensions 0.8.64 review

The released range `6b7447e..4709081` was reviewed commit by commit:

- `7562198` is **selectively ported**: isolated message-hint hover and unified expanded-card padding/background are included. Its model-status removal is not copied because this aggregate uses `pi-footer` and never registered the upstream model-status feature.
- `8d53291` is **reviewed but not ported**: upstream package version, lockfile, and upstream-namespace render-example documentation remain outside this monorepo sync.
- `4709081` is **ported**: expanded thinking wraps use bounded per-message/run/width caching, collapse evicts only that run, and double-click identity survives component rebuilds without crossing runs.

The fork keeps its renderer-first compact-thinking lifecycle bridge, message-display hardening, live mouse TUI slot, terminal-width handling, Markdown fence/inline protection, compact-thinking coexistence, rich diff ANSI/CRLF/write metadata, and dedicated Agent renderer. Package provenance and the repository review cursor advance to released `v0.8.64` at `4709081`.

### pi-subagents 0.18.1, 0.18.2, and 0.19 workflow review

The released range `a9db27b..ad81024` was reviewed commit by commit:

- `92422a4` is **selectively ported**: agent records and UI expose requested and effective model/thinking settings while retaining this fork's tolerant model resolution.
- `917853c` is **ported**: the conversation viewer gains Markdown modes with bounded fallback rendering, and agent files safely accept a UTF-8 BOM while preserving malformed-agent recovery.
- `e56085d` is **selectively ported**: foreground tasks use an independent concurrency pool and per-invocation spawn callbacks; nested, RPC, detached, and resumed tasks retain their ownership exemptions to avoid deadlock.
- `084d177` is **selectively ported**: cross-extension RPC applies model-scope policy after resolving string model requests through the local resolver.
- Benchmark, host documentation, upstream namespace, lockfile, and release-only changes are reviewed but not copied.

Package provenance advances to released `v0.18.2` at `ad81024`. The later workflow engine through `v0.19.0` at `bd446fc` is **deferred** as a separate product surface: it adds workers, workflow ownership, structured output, worktree gates, and substantial prompt/runtime cost beyond the maintained subagent contract. The repository review cursor advances through `bd446fc` so those commits are not repeatedly reported.

### pi-subagents post-0.18.0 review

The unreleased range `3f9d35c..a9db27b` was reviewed commit by commit:

- `c73e968` and its `7e695f3` changelog follow-up are **ported**: Ctrl+C now closes the conversation viewer when no steering composer owns input.
- `a9db27b` is **selectively ported**: `subagents:rpc:consume` marks only settled top-level results consumed and cancels their pending nudge, while preserving this fork's model resolution, top-level spawn filtering, parent ownership, and lifecycle gates.

The repository review cursor advances to `a9db27b`. Package provenance remains the published `0.18.0` tag at `3f9d35c`; unreleased commits are not represented as a package version baseline.

### pi-subagents 0.18.0 review

The released range `bb47763..3f9d35c` was reviewed commit by commit:

- `5f8deda` and its `b4de91e` / `49ffd5c` / `42460ca` follow-ups (`@handle` mentions) remain **deferred**. The feature still conflicts with this fork's parent-session links, nested ownership, fallback/runtime compatibility, malformed-agent recovery, and composed `@` provider; no mention lifecycle code or settings are shipped.
- `285b692` (selected FleetView row) remains **ported**, preserving the configured badge and stable columns.
- `1b82530` worktree controls are **ported**, including `isolation: off` and the project-wide worktree switch while retaining unsigned preservation commits.
- The 0.18.0 background default, usage/cost reporting, RPC activity, child-session shutdown, nanoid security update, and nested print-mode coverage are **ported**. Nested delegation continues to default to foreground so a parent cannot finish before collecting its child.

Both package provenance and the repository review cursor advance to the released `0.18.0` tag at `3f9d35c`.

### resume-from 0.2.0 import

The complete v0.2.0 source and test suite are imported at `e1dad0d`. The local package preserves upstream formatting and its MIT license. The maintained patch reads repository ownership from the earliest main-session record instead of the current active chain, whose cwd may change after Claude Code resets or compacts the transcript.

## Upstream contribution follow-ups

- The stable Claude Code repository-ownership fix is tracked by upstream [issue #5](https://github.com/alexei-led/resume-from/issues/5) and [PR #6](https://github.com/alexei-led/resume-from/pull/6); drop the local patch after an equivalent upstream release is reviewed.
- The `pi-subagents` agent display-name/color customization is merged upstream at `2d5b904`; keep the local implementation for the maintained package identity and compatibility patches, and re-audit it on future upstream syncs.
- Propose the `pi-cc-extensions` fence/inline-code-safe circled-number normalization and its focused Markdown regression tests to `minuque/pi-cc-extensions`; keep the local implementation until upstream accepts an equivalent change.
- Propose the `pi-cc-extensions` renderer-first compact-thinking lifecycle bridge and package-entry teardown regression test to `minuque/pi-cc-extensions`; without the bridge, shutdown can leave a stale compact-thinking prototype wrapper beneath compact mode.
- Split the post-`0.8.54` review fixes into focused upstream PRs: agent discovery resilience, Working footer lifecycle guards, renderer timer/cache/shutdown ownership, live mouse-state reads, Markdown fence protection, and diff ANSI/line-ending/write-metadata correctness. Keep the local regressions until upstream accepts equivalents.

## Bundled upstream companions

The aggregate package also pins the following npm packages under their original names without modifying their upstream source. The generated bundled `remote-pi` manifest omits its Pi coding-agent/TUI dependencies so it uses the aggregate's single host versions:

| Package                              | Version  | Upstream                    |
| ------------------------------------ | -------- | --------------------------- |
| `@dietrichgebert/ponytail`           | `4.9.0`  | `DietrichGebert/ponytail`   |
| `@juicesharp/rpiv-ask-user-question` | `2.7.1`  | `juicesharp/rpiv-mono`      |
| `@luxusai/pi-hindsight`              | `0.12.0` | `luxus/pi-hindsight`        |
| `@narumitw/pi-btw`                   | `0.55.4` | `narumiruna/pi-extensions`  |
| `@pi-plugins/fast-mode`              | `0.1.10` | `k3dom/pi-plugins`          |
| `@tifan/pi-copy-response`            | `0.2.6`  | `tifandotme/pi-extensions`  |
| `@tifan/pi-handoff`                  | `2.0.1`  | `tifandotme/pi-extensions`  |
| `@tifan/pi-inline-skills`            | `1.0.5`  | `tifandotme/pi-extensions`  |
| `@tifan/pi-mermaid-open`             | `0.2.0`  | `tifandotme/pi-extensions`  |
| `@tifan/pi-preferred-thinking`       | `1.0.0`  | `tifandotme/pi-extensions`  |
| `@tifan/pi-recap`                    | `0.4.5`  | `tifandotme/pi-extensions`  |
| `@tifan/pi-rename`                   | `0.5.1`  | `tifandotme/pi-extensions`  |
| `@tifan/pi-titlebar-spinner`         | `0.1.3`  | `tifandotme/pi-extensions`  |
| `pi-mcp-adapter`                     | `2.29.0` | `nicobailon/pi-mcp-adapter` |
| `pi-footer`                          | `0.5.1`  | `wobondar/pi-footer`        |
| `pi-lens`                            | `4.1.2`  | `apmantza/pi-lens`          |
| `pi-web-access`                      | `0.25.0` | `nicobailon/pi-web-access`  |
| `remote-pi`                          | `0.7.0`  | `jacobaraujo7/remote_pi`    |
| `@czottmann/pi-automode`             | `1.13.0` | `czottmann/pi-automode`     |

The issue #126 companion review accepted two released updates:

- `pi-btw@0.55.4` contains release metadata only and advances the promoted `pi-tui-kit` dependency to `^0.59.0`.
- `pi-mcp-adapter@2.29.0` adds an opt-in Parallel Search setup preset and reliable status text in non-TUI hosts without changing its runtime dependency versions.

The earlier issue #122 companion review accepted six released updates:

- `pi-automode@1.13.0` parses shell commands before policy matching and migrates legacy configuration; its new `unbash@4.0.10` dependency is ISC-licensed.
- `rpiv-ask-user-question@2.7.1` contains release/dependency metadata only and advances `rpiv-config` to `^2.7.1`.
- `pi-btw@0.55.3` restores editor/search focus after Ctrl+C and advances `pi-tui-kit` to `^0.58.1`.
- `pi-lens@4.1.2` fixes delayed and stale LSP delivery, process cleanup, and snapshot completeness. The reviewed release baseline is tag `v4.1.2` at commit `1b83ea8`.
- `pi-mcp-adapter@2.28.0` adds namespace tools, cross-extension registration, progress, TTL, and recovery without changing its dependency or peer contract.
- `pi-web-access@0.25.0` adds opt-in proxy and cloud-auth providers, GitHub-aware fetching, and a default Defuddle extraction fallback; its new `defuddle@0.19.3` dependency is MIT-licensed.

These are dependencies, not source imports or `@herbertgao/*` releases. Review their changelogs, licenses, package manifests, and runtime smoke results before changing a pin.

`@luxusai/pi-hindsight@0.12.0` is accepted for cross-host memory through a self-hosted Hindsight server. The package declares MIT and bundles its Pi extension and memory-doctor skill, but its repository does not currently ship a standalone `LICENSE` file; preserve the package declaration, upstream attribution, and aggregate third-party notice. Keep project/user banks opt-in and do not point the extension at a public unauthenticated server.

`remote-pi@0.7.0` is accepted for this personal aggregate only with a self-hosted relay restricted by Tailscale or an equivalent private network. Its relay sees routed plaintext, despite transport encryption. Re-audit before every pin change and remove these accepted exceptions when upstream fixes them: pairing URI/token data is currently persisted in Pi session data and can reach model context; local broker/supervisor IPC authenticates only through the OS-user boundary, and its Unix socket may use the process umask's default `0755` mode; cancelling first-time setup can retain the cwd lock until process exit; the setup wizard's “encrypted messages” wording overstates relay confidentiality. Do not test against or recommend the community relay.

## Remotes

```text
origin               HerbertGao/pi-extensions
tifan-upstream       tifandotme/pi-extensions
tintinweb-upstream   tintinweb/pi-subagents
minuque-upstream     minuque/pi-cc-extensions
alexei-upstream      alexei-led/resume-from
```

Treat every `*-upstream` remote as fetch-only even though Git records a push URL.

## Sync workflow

Use merge-based history for released code:

```bash
git fetch --all --tags
git switch master
git switch -c sync/tifan-YYYYMMDD
# Merge or selectively port the upstream changes, preserving @herbertgao metadata.
bun install
bun run check
bun changeset
git diff master...HEAD
```

For subagents, compare the recorded baseline before porting:

```bash
git diff 4cc4738..tintinweb-upstream/master -- src test README.md package.json
```

Paths from that standalone repository map under `packages/pi-subagents/` here. Review package manifests and docs separately because this monorepo intentionally uses different npm scope, repository metadata, lockfile, and release tooling.

The `minuque/pi-cc-extensions` MIT license was added in upstream commit `58743f2` and confirmed by the maintainer in issue #3. Preserve that LICENSE and upstream attribution during every sync.

## Package manifest standard

Every publishable package must have:

- `@herbertgao/<original-unscoped-name>` identity;
- explicit `license`, `files`, `repository.directory`, `homepage`, and `bugs`;
- `publishConfig.access = public` and `publishConfig.provenance = true`;
- a Pi resource manifest;
- `x-upstream` provenance for derived packages;
- original copyright and license notices.

Cross-package dependencies use `@herbertgao/*`. The aggregate package pins exact versions and lists every maintained child and upstream companion in `bundledDependencies` so Pi can load resources through `node_modules/` under one isolated package root.

Maintained child packages use SemVer and normally preserve their imported upstream version. The aggregate package uses UTC CalVer in `YYYY.M.PATCH` form, without a leading `v` or a zero-padded month. Release PRs prepared in the same month increment `PATCH`; the first release PR prepared in a new month resets it to `0`. Add a patch Changeset for aggregate changes. `scripts/version-packages.mjs` runs Changesets, then normalizes the aggregate version for the UTC month when the version PR is generated and updates its generated changelog heading.

Recommended configuration files may be shipped under `packages/pi-extensions/examples/`, but package installation must not write into `~/.pi` or replace existing user configuration. Keep examples valid against the pinned companion version and assert their presence and parsing in the aggregate smoke test.

`packages/pi-extensions` uses `scripts/aggregate-bundle.mjs` during `npm pack` and `npm publish`. It bundles only the 23 direct Pi packages, then promotes their immediate runtime dependencies into the aggregate manifest so npm installs platform-specific transitive dependencies on the consumer machine. Do not replace this with Bun workspace symlinks or recursively bundled native dependencies. `bun run test:aggregate` must pass before release.

## npm and Trusted Publishing bootstrap

The npm account must have two-factor authentication enabled. The current machine must authenticate first and use Node 22.22.2 or newer plus npm 12 or newer for the `npm trust` command:

```bash
node --version
npm login
npm whoami
npm install --global npm@12.0.2
```

For each new scoped package, publish once locally before configuring Trusted Publishing:

```bash
cd packages/<package>
npm publish --access public --provenance=false
npm trust github @herbertgao/<package> \
  --repository HerbertGao/pi-extensions \
  --file release.yml \
  --allow-publish \
  --yes
```

Run the aggregate package last, after all exact child versions exist. Do not create a long-lived `NPM_TOKEN` or a granular token that bypasses 2FA; the release workflow authenticates with GitHub OIDC and publishes with provenance. Enable the repository variable only after every package trusts the workflow:

```bash
gh variable set NPM_RELEASE_ENABLED --repo HerbertGao/pi-extensions --body true
```

The release workflow intentionally runs only on pushes to `master`. Do not add unrestricted `workflow_dispatch`: npm trusts the workflow file, and a manual run could otherwise select an arbitrary branch. If manual releases become necessary, first bind npm trust to a GitHub environment whose deployment branches are restricted to `master`.

Subsequent releases are Changeset PRs published through GitHub Actions OIDC with provenance. Never store an npm token in repository secrets.
