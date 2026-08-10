# Maintenance and release policy

## Repository roles

- [`HerbertGao/pi-extensions`](https://github.com/HerbertGao/pi-extensions) is the independent source and release monorepo.
- [`HerbertGao/tifandotme-pi-extensions`](https://github.com/HerbertGao/tifandotme-pi-extensions) remains the GitHub fork used for Tifan upstream contributions.
- Sibling working repositories are upstream work areas, not package-manager workspaces. Never mutate a dirty sibling while importing it.

## Source baselines

| Local package set      | Upstream                   | Imported baseline                                     | Notes                                                                                                                                                |
| ---------------------- | -------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tifan-derived packages | `tifandotme/pi-extensions` | `5975a48`                                             | Fixed Editor includes the merged streaming repaint fix and is frozen as a legacy package for Pi versions before 0.84.                                |
| `pi-subagents`         | `tintinweb/pi-subagents`   | `2966cd5` plus the sibling working-tree customization | The imported customization adds Claude Code/Agency Agents-compatible name colors across the tool header, widget, FleetView, and conversation viewer. |
| `pi-cc-extensions`     | `minuque/pi-cc-extensions` | `b94bb6b` (`0.8.51`)                                  | Imported after upstream added an explicit MIT license; uses Pi 0.84's native fullscreen pipeline.                                                    |

Record a new upstream commit in this table whenever a sync is accepted. Each derived package also carries canonical `x-upstream` metadata in its own `package.json`:

| Local package                       | Upstream package               | Imported version | Imported commit |
| ----------------------------------- | ------------------------------ | ---------------- | --------------- |
| `@herbertgao/pi-cc-extensions`      | `pi-cc-extensions`             | `0.8.51`         | `b94bb6b`       |
| `@herbertgao/pi-copy-response`      | `@tifan/pi-copy-response`      | `0.2.6`          | `460d580`       |
| `@herbertgao/pi-fixed-editor`       | `@tifan/pi-fixed-editor`       | `0.3.0`          | `5975a48`       |
| `@herbertgao/pi-handoff`            | `@tifan/pi-handoff`            | `1.1.2`          | `460d580`       |
| `@herbertgao/pi-inline-skills`      | `@tifan/pi-inline-skills`      | `1.0.5`          | `460d580`       |
| `@herbertgao/pi-mermaid-open`       | `@tifan/pi-mermaid-open`       | `0.1.3`          | `460d580`       |
| `@herbertgao/pi-preferred-thinking` | `@tifan/pi-preferred-thinking` | `0.3.0`          | `460d580`       |
| `@herbertgao/pi-recap`              | `@tifan/pi-recap`              | `0.4.4`          | `460d580`       |
| `@herbertgao/pi-rename`             | `@tifan/pi-rename`             | `0.4.2`          | `460d580`       |
| `@herbertgao/pi-stash`              | `@tifan/pi-stash`              | `0.1.0`          | `460d580`       |
| `@herbertgao/pi-subagents`          | `@tintinweb/pi-subagents`      | `0.14.3`         | `2966cd5`       |
| `@herbertgao/pi-titlebar-spinner`   | `@tifan/pi-titlebar-spinner`   | `0.1.3`          | `460d580`       |

`upstreams.json` records repository review cursors and original-name companion repositories. `scripts/check-upstreams.mjs` validates these records, checks npm latest versions and GitHub default-branch commits, and powers the daily `Upstream Monitor` workflow. The workflow maintains one rolling GitHub Issue instead of opening duplicate reminders.

## Bundled upstream companions

The aggregate package also pins the following unmodified npm packages under their original names:

| Package                              | Version  | Upstream                    |
| ------------------------------------ | -------- | --------------------------- |
| `@juicesharp/rpiv-ask-user-question` | `2.4.0`  | `juicesharp/rpiv-mono`      |
| `pi-mcp-adapter`                     | `2.19.0` | `nicobailon/pi-mcp-adapter` |
| `pi-lens`                            | `3.8.74` | `apmantza/pi-lens`          |
| `pi-web-access`                      | `0.18.0` | `nicobailon/pi-web-access`  |
| `@czottmann/pi-automode`             | `1.9.0`  | `czottmann/pi-automode`     |

These are dependencies, not source imports or `@herbertgao/*` releases. Review their changelogs, licenses, package manifests, and runtime smoke results before changing a pin.

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
git diff 2966cd5..tintinweb-upstream/master -- src test README.md package.json
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

`packages/pi-extensions` uses `scripts/aggregate-bundle.mjs` during `npm pack` and `npm publish`. It bundles only the 16 direct Pi packages, then promotes their immediate runtime dependencies into the aggregate manifest so npm installs platform-specific transitive dependencies on the consumer machine. Do not replace this with Bun workspace symlinks or recursively bundled native dependencies. `bun run test:aggregate` must pass before release.

## Initial npm and OIDC bootstrap

The current machine must authenticate first:

```bash
npm login
npm whoami
```

For each new scoped package, publish once locally before configuring trusted publishing:

```bash
cd packages/<package>
npm publish --access public --provenance=false
npm trust github @herbertgao/<package> \
  --repository HerbertGao/pi-extensions \
  --file release.yml \
  --allow-publish \
  --yes
```

Run the aggregate package last, after all exact child versions exist. Enable the repository variable only after every package trusts the workflow:

```bash
gh variable set NPM_RELEASE_ENABLED --repo HerbertGao/pi-extensions --body true
```

Subsequent releases are Changeset PRs published through GitHub Actions OIDC with provenance. Never store an npm token in repository secrets.
