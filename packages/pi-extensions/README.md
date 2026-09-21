# @herbertgao/pi-extensions

Aggregate installer for HerbertGao-maintained Pi extensions and pinned upstream companions.

## Install

```bash
pi install npm:@herbertgao/pi-extensions
```

Requires Node.js 24 or newer and Pi 0.85.1 or newer.

The package bundles 6 active `@herbertgao/*` child packages—`pi-bark`, `pi-cc-extensions`, `resume-from`, `pi-subagents`, `sol-pi`, and the maintained Antigravity provider mirror—plus the following upstream packages under their original names:

- `pi-antigravity@0.7.2`
- `@dietrichgebert/ponytail@4.9.0`
- `@juicesharp/rpiv-ask-user-question@2.8.0`
- `@narumitw/pi-btw@0.59.0`

- `@narumitw/pi-caffeinate@0.49.7`
- `@pi-plugins/fast-mode@0.1.10`
- `@tifan/pi-copy-response@0.2.6`
- `@tifan/pi-handoff@2.2.0`
- `@tifan/pi-inline-skills@1.0.5`
- `@tifan/pi-mermaid-open@0.2.0`
- `@tifan/pi-preferred-thinking@1.0.1`
- `@tifan/pi-recap@0.4.6`
- `@tifan/pi-rename@0.6.0`
- `pi-mcp-adapter@2.31.0`
- `pi-typesafe@0.5.0`
- `pi-multi-account@1.22.0`
- `pi-footer@0.5.1`
- `pi-jev-auto-mode@0.4.1`
- `pi-lens@4.2.1`
- `pi-web-access@0.27.0`
- `remote-pi@0.7.0`

Pi loads their extensions and skills through `node_modules/` paths inside one package root. The upstream companions are pinned and bundled, not forked or renamed.

### Bark notifications

`@herbertgao/pi-bark` sends localized Bark pushes when a user-facing Pi run fully settles or `@juicesharp/rpiv-ask-user-question` needs an answer. Notifications include emoji-labeled machine/path metadata and support the bundled official Pi badge through Bark's `icon` parameter. Configure it in `$PI_CODING_AGENT_DIR/bark.json` (normally `~/.pi/agent/bark.json`); see the [package README](../pi-bark/README.md). Without a valid endpoint it stays inactive.

`@narumitw/pi-caffeinate@0.49.7` uses the host platform's sleep inhibitor during each Pi agent run. On macOS, `/caffeinate sleep` keeps the system awake while allowing the display to sleep; `/caffeinate display` also keeps the display awake. It releases the inhibitor when the run or session ends.

`pi-jev-auto-mode@0.4.1` adds fail-closed Jev safety gates for shell commands and file changes. `pi-typesafe@0.5.0` adds the `/typesafe` command and `typesafe_evaluate` tool for explicit structured decisions; both use the TypeSafe API after login.

`@herbertgao/resume-from@0.2.0` keeps Claude Code sessions associated with their original repository when the active transcript later moves into a nested cwd. `@herbertgao/sol-pi@0.1.0` adds opt-in Action Fusion, ObservationPack, Evidence-Preserving Reducer, and Online Context Compact; see its [configuration guide](../sol-pi/docs/configuration.md). `pi-lens@4.2.1` expands language routing and bounds retained diagnostic facts across multi-root sessions. `pi-web-access@0.27.0` adds configurable fetch deadlines and answer models plus isolated GitHub clone runtimes. Preferred Thinking 1.0.1 preserves an explicit subagent `--thinking` choice. Deprecated `@tifan/pi-titlebar-spinner` is no longer bundled; Rename remains the single owner of Herdr tab naming.

`pi-stash` is no longer bundled: `/btw` already preserves the main editor draft while handling side questions outside the main conversation. Prior `@herbertgao/pi-stash` releases remain available but are no longer maintained here.

If `pi-footer` was installed separately before upgrading to an aggregate release that includes it, remove the standalone source shown by `pi list` so only the bundled copy loads. For the pinned standalone install used while preparing this integration:

```bash
pi remove npm:pi-footer@0.5.1
```

### Footer

`pi-footer` is enabled by the aggregate. It preserves the native path, Git branch, session, token/context, model, and thinking information. Configure it in `$PI_CODING_AGENT_DIR/extensions/pi-footer.json`; use `/footer` for interactive changes. Only one footer-replacement extension should be enabled at a time.

For the intended compact status text, merge these optional companion settings into existing files rather than replacing the files:

```jsonc
// ~/.pi/agent/mcp.json
{
  "settings": {
    "mcpFooterStatus": "compact",
    "showStatusIcon": false
  }
}

// ~/.pi-lens/config.json
{
  "widget": {
    "visible": false
  }
}
```

Pi 0.85.1 or newer should use native `fullscreen` TUI mode.

### Remote Pi trust boundary

Configure `REMOTE_PI_RELAY` to a private relay, preferably reachable only through Tailscale or another private network, **before** first running `/remote-pi`. TLS/Tailscale protects traffic in transit but the relay process can read routed content; `remote-pi@0.7.0` is not end-to-end encrypted.

Known accepted `0.7.0` limitations: pairing URI/token data is persisted in Pi session data and may enter model context during its short validity window; local broker/supervisor IPC trusts processes running as the same OS user; cancelling first-time setup can retain its cwd lock until Pi exits. Do not use the public relay or run untrusted local processes if those boundaries are unacceptable.

See the [repository README](https://github.com/HerbertGao/pi-extensions#readme) for the complete package list and provenance.

## License

[MIT](LICENSE). Bundled upstream notices are included in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
