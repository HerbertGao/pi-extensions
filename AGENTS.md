# Repository Instructions

This is the independent `HerbertGao/pi-extensions` monorepo. Published packages use the npm scope `@herbertgao/`.

## Package policy

- Every publishable package lives under `packages/<name>/` and is named `@herbertgao/<name>`.
- The aggregate package is `@herbertgao/pi-extensions`; it bundles the individually published packages and is the preferred one-command install.
- Each package declares an explicit license, `files`, Pi resources, repository metadata with its monorepo directory, and `publishConfig: { "access": "public", "provenance": true }`.
- Preserve upstream attribution and original license notices. Record source repository, package, version, and commit in `x-upstream` metadata.
- Do not copy or publish code without an explicit redistribution license. Preserve the MIT license and provenance for the imported `minuque/pi-cc-extensions` source.
- Runtime dependencies belong in the package that imports them. Other Pi packages referenced by the aggregate package must appear in both `dependencies` and `bundledDependencies`.
- Pi extensions are TypeScript loaded directly by Pi through jiti; do not add a build step unless a package requires one.

## Upstream maintenance

- `origin`: independent HerbertGao repository.
- `<owner>-upstream` remotes: read-only conceptual sources. Never push to them.
- Bring upstream updates through a `sync/<source>-<date>` branch, merge or port only reviewed changes, preserve our namespace/metadata, run all checks, and add a Changeset.
- Never rebase a branch after one of its commits has been released or tagged.
- See `docs/maintenance.md` for source baselines and sync commands.

## Development

Use Bun at repository root:

```bash
bun install
bun run format:check
bun run lint
bun run typecheck
bun run test
```

Run `bun run check` before release-facing changes. Add or update tests for behavior changes.

## Changesets and release

- Add a Changeset for every user-visible package change after the initial scoped-package bootstrap.
- Versions are independent. Use patch for fixes, minor for features, and major only for intentional breaking changes in packages already at `1.x`.
- GitHub Actions uses npm trusted publishing with OIDC and provenance.
- Never run `npm publish`, enable release automation, push, tag, or create a GitHub release unless the user explicitly requests it.
- Initial npm publication is manual because npm requires each package to exist before trusted publishing can be configured.

## Git

- Keep changes focused and use Conventional Commits.
- Do not modify sibling source repositories while importing or comparing upstream work.
- Do not commit session JSONL files, dependency directories, build output, or credentials.
