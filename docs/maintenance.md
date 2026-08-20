# Maintenance and release policy

## Repository roles

- [`HerbertGao/pi-extensions`](https://github.com/HerbertGao/pi-extensions) is the independent source and release monorepo.
- [`HerbertGao/tifandotme-pi-extensions`](https://github.com/HerbertGao/tifandotme-pi-extensions) remains the GitHub fork used for Tifan upstream contributions.
- Sibling working repositories are upstream work areas, not package-manager workspaces. Never mutate a dirty sibling while importing it.

## Source baselines

| Local package set      | Upstream                   | Imported baseline    | Notes                                                                                                                                               |
| ---------------------- | -------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tifan-derived packages | `tifandotme/pi-extensions` | `5975a48`            | Fixed Editor includes the merged streaming repaint fix and is frozen as a legacy package for Pi versions before 0.84.                               |
| `pi-subagents`         | `tintinweb/pi-subagents`   | `3f9d35c` (`0.18.0`) | The fork preserves warning recovery, runtime compatibility, package identity, parent-session persistence, nested delegation, and local UI surfaces. |
| `pi-cc-extensions`     | `minuque/pi-cc-extensions` | `268e017` (`0.8.60`) | Selectively tracks the release while preserving local terminal-width, Markdown fence, mouse-slot, and renderer-lifecycle fixes.                     |

Record a new upstream commit in this table whenever a sync is accepted. Each derived package also carries canonical `x-upstream` metadata in its own `package.json`:

| Local package                       | Upstream package               | Imported version | Imported commit |
| ----------------------------------- | ------------------------------ | ---------------- | --------------- |
| `@herbertgao/pi-cc-extensions`      | `pi-cc-extensions`             | `0.8.60`         | `268e017`       |
| `@herbertgao/pi-copy-response`      | `@tifan/pi-copy-response`      | `0.2.6`          | `460d580`       |
| `@herbertgao/pi-fixed-editor`       | `@tifan/pi-fixed-editor`       | `0.3.0`          | `5975a48`       |
| `@herbertgao/pi-handoff`            | `@tifan/pi-handoff`            | `1.1.2`          | `460d580`       |
| `@herbertgao/pi-inline-skills`      | `@tifan/pi-inline-skills`      | `1.0.5`          | `460d580`       |
| `@herbertgao/pi-mermaid-open`       | `@tifan/pi-mermaid-open`       | `0.1.3`          | `460d580`       |
| `@herbertgao/pi-preferred-thinking` | `@tifan/pi-preferred-thinking` | `0.3.0`          | `460d580`       |
| `@herbertgao/pi-recap`              | `@tifan/pi-recap`              | `0.4.4`          | `460d580`       |
| `@herbertgao/pi-rename`             | `@tifan/pi-rename`             | `0.4.2`          | `460d580`       |
| `@herbertgao/pi-stash`              | `@tifan/pi-stash`              | `0.1.0`          | `460d580`       |
| `@herbertgao/pi-subagents`          | `@tintinweb/pi-subagents`      | `0.18.0`         | `3f9d35c`       |
| `@herbertgao/pi-titlebar-spinner`   | `@tifan/pi-titlebar-spinner`   | `0.1.3`          | `460d580`       |

`upstreams.json` records repository review cursors and original-name companion repositories. `scripts/check-upstreams.mjs` validates these records, checks npm latest versions and GitHub default-branch commits, and powers the daily `Upstream Monitor` workflow. For npm release changes, the workflow updates the open upstream-tracking Issue with the matching title, or creates a new Issue when no matching open Issue exists. Unreleased commits remain visible in the workflow summary without opening an Issue. Query errors fail the workflow without changing the Issue state.

### pi-subagents 0.18.0 review

The released range `bb47763..3f9d35c` was reviewed commit by commit:

- `5f8deda` and its `b4de91e` / `49ffd5c` / `42460ca` follow-ups (`@handle` mentions) remain **deferred**. The feature still conflicts with this fork's parent-session links, nested ownership, fallback/runtime compatibility, malformed-agent recovery, and composed `@` provider; no mention lifecycle code or settings are shipped.
- `285b692` (selected FleetView row) remains **ported**, preserving the configured badge and stable columns.
- `1b82530` worktree controls are **ported**, including `isolation: off` and the project-wide worktree switch while retaining unsigned preservation commits.
- The 0.18.0 background default, usage/cost reporting, RPC activity, child-session shutdown, nanoid security update, and nested print-mode coverage are **ported**. Nested delegation continues to default to foreground so a parent cannot finish before collecting its child.

Both package provenance and the repository review cursor advance to the released `0.18.0` tag at `3f9d35c`.

## Upstream contribution follow-ups

- The `pi-subagents` agent display-name/color customization is merged upstream at `2d5b904`; keep the local implementation for the maintained package identity and compatibility patches, and re-audit it on future upstream syncs.
- Propose the `pi-cc-extensions` fence/inline-code-safe circled-number normalization and its focused Markdown regression tests to `minuque/pi-cc-extensions`; keep the local implementation until upstream accepts an equivalent change.
- Propose the `pi-cc-extensions` renderer-first compact-thinking lifecycle bridge and package-entry teardown regression test to `minuque/pi-cc-extensions`; without the bridge, shutdown can leave a stale compact-thinking prototype wrapper beneath compact mode.
- Split the post-`0.8.54` review fixes into focused upstream PRs: agent discovery resilience, Working footer lifecycle guards, renderer timer/cache/shutdown ownership, live mouse-state reads, Markdown fence protection, and diff ANSI/line-ending/write-metadata correctness. Keep the local regressions until upstream accepts equivalents.

## Bundled upstream companions

The aggregate package also pins the following npm packages under their original names without modifying their upstream source. The generated bundled `remote-pi` manifest omits its Pi coding-agent/TUI dependencies so it uses the aggregate's single host versions:

| Package                              | Version  | Upstream                    |
| ------------------------------------ | -------- | --------------------------- |
| `@dietrichgebert/ponytail`           | `4.9.0`  | `DietrichGebert/ponytail`   |
| `@juicesharp/rpiv-ask-user-question` | `2.6.0`  | `juicesharp/rpiv-mono`      |
| `@narumitw/pi-btw`                   | `0.52.0` | `narumiruna/pi-extensions`  |
| `@pi-plugins/fast-mode`              | `0.1.9`  | `k3dom/pi-plugins`          |
| `pi-mcp-adapter`                     | `2.26.0` | `nicobailon/pi-mcp-adapter` |
| `pi-footer`                          | `0.5.1`  | `wobondar/pi-footer`        |
| `pi-lens`                            | `4.0.1`  | `apmantza/pi-lens`          |
| `pi-web-access`                      | `0.23.0` | `nicobailon/pi-web-access`  |
| `remote-pi`                          | `0.7.0`  | `jacobaraujo7/remote_pi`    |
| `@czottmann/pi-automode`             | `1.11.0` | `czottmann/pi-automode`     |

These are dependencies, not source imports or `@herbertgao/*` releases. Review their changelogs, licenses, package manifests, and runtime smoke results before changing a pin.

`remote-pi@0.7.0` is accepted for this personal aggregate only with a self-hosted relay restricted by Tailscale or an equivalent private network. Its relay sees routed plaintext, despite transport encryption. Re-audit before every pin change and remove these accepted exceptions when upstream fixes them: pairing URI/token data is currently persisted in Pi session data and can reach model context; local broker/supervisor IPC authenticates only through the OS-user boundary, and its Unix socket may use the process umask's default `0755` mode; cancelling first-time setup can retain the cwd lock until process exit; the setup wizard's “encrypted messages” wording overstates relay confidentiality. Do not test against or recommend the community relay.

## Remotes

```text
origin               HerbertGao/pi-extensions
tifan-upstream       tifandotme/pi-extensions
tintinweb-upstream   tintinweb/pi-subagents
minuque-upstream     minuque/pi-cc-extensions
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

`packages/pi-extensions` uses `scripts/aggregate-bundle.mjs` during `npm pack` and `npm publish`. It bundles only the 21 direct Pi packages, then promotes their immediate runtime dependencies into the aggregate manifest so npm installs platform-specific transitive dependencies on the consumer machine. Do not replace this with Bun workspace symlinks or recursively bundled native dependencies. `bun run test:aggregate` must pass before release.

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
