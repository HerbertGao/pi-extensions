# @herbertgao/pi-impeccable

The [Impeccable](https://github.com/pbakaus/impeccable) design skill for [Pi](https://pi.dev/), vendored from the official `skill-v4.8.0` release. It provides design steering, critique, audit, and deterministic anti-pattern detection without an installer, background service, or global skill directory.

## Install

```bash
pi install npm:@herbertgao/pi-impeccable
```

Restart Pi or run `/reload`, then invoke the skill:

```text
/skill:impeccable init
/skill:impeccable critique src
/skill:impeccable audit src
/skill:impeccable polish src
```

The package does not register a separate `/impeccable` command. Pi does not install Impeccable's post-edit hooks, so detection runs only when requested.

## Engine setup

The skill's launcher downloads the pinned native engine on first use and verifies it against the bundled SHA-256 checksums. This requires network access and a writable `~/.impeccable` cache. For offline or preinstalled setups, set `IMPECCABLE_BIN` to a compatible engine binary.

Upstream `pin` and `unpin` only discover skill installations in project harness directories. They do not support this npm-loaded package; invoke commands through `/skill:impeccable` instead.

## Updates and provenance

This package vendors the complete official Pi payload: 58 files from commit [`414603bf14c7a344edb466bb1f85690c77ce8b7d`](https://github.com/pbakaus/impeccable/commit/414603bf14c7a344edb466bb1f85690c77ce8b7d). Updates are reviewed and released through this repository rather than the upstream auto-updater.

## License

[Apache-2.0](LICENSE). See [NOTICE.md](NOTICE.md) for upstream third-party notices. This package is an independent distribution and is not affiliated with or endorsed by the Impeccable project.
