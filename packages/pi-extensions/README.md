# @herbertgao/pi-extensions

Aggregate installer for HerbertGao-maintained Pi extensions and pinned upstream companions.

## Install

```bash
pi install npm:@herbertgao/pi-extensions
```

Requires Node.js 24 or newer.

The package bundles 3 active `@herbertgao/*` child packages—`pi-cc-extensions`, `resume-from`, and `pi-subagents`—plus the following upstream packages under their original names:

- `@dietrichgebert/ponytail@4.9.0`
- `@juicesharp/rpiv-ask-user-question@2.7.1`
- `@luxusai/pi-hindsight@0.12.0`
- `@narumitw/pi-btw@0.55.4`
- `@pi-plugins/fast-mode@0.1.10`
- `@tifan/pi-copy-response@0.2.6`
- `@tifan/pi-handoff@2.0.1`
- `@tifan/pi-inline-skills@1.0.5`
- `@tifan/pi-mermaid-open@0.2.0`
- `@tifan/pi-preferred-thinking@1.0.1`
- `@tifan/pi-recap@0.4.5`
- `@tifan/pi-rename@0.5.1`
- `@tifan/pi-titlebar-spinner@0.1.3`
- `pi-mcp-adapter@2.30.0`
- `pi-footer@0.5.1`
- `pi-lens@4.1.2`
- `pi-web-access@0.26.0`
- `remote-pi@0.7.0`
- `@czottmann/pi-automode@1.14.0`

Pi loads their extensions and skills through `node_modules/` paths inside one package root. The upstream companions are pinned and bundled, not forked or renamed.

`@herbertgao/resume-from@0.2.0` keeps Claude Code sessions associated with their original repository when the active transcript later moves into a nested cwd. `pi-lens@4.1.2` improves delayed LSP diagnostics, stale-result cleanup, process cleanup, and snapshot completeness. `pi-automode@1.14.0` bounds classifier streams and permits only validated temporary-directory subtrees. `pi-web-access@0.26.0` adds explicit XCrawl search plus safer query and extraction fallbacks. Preferred Thinking 1.0.1 preserves an explicit subagent `--thinking` choice.

`pi-stash` is no longer bundled: `/btw` already preserves the main editor draft while handling side questions outside the main conversation. Prior `@herbertgao/pi-stash` releases remain available but are no longer maintained here.

If `pi-footer` was installed separately before upgrading to an aggregate release that includes it, remove the standalone source shown by `pi list` so only the bundled copy loads. For the pinned standalone install used while preparing this integration:

```bash
pi remove npm:pi-footer@0.5.1
```

### Recommended footer

`pi-footer` is enabled by the aggregate. To use the recommended compact layout for MCP, Auto mode, LSP, Ponytail, Remote Pi, and Subagents, copy the bundled example to Pi's user config directory:

```bash
agent_dir="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
mkdir -p "$agent_dir/extensions"
cp "$agent_dir/npm/node_modules/@herbertgao/pi-extensions/examples/pi-footer.json" \
  "$agent_dir/extensions/pi-footer.json"
```

The same copy is linked here as [`examples/pi-footer.json`](examples/pi-footer.json). The example preserves the native path, Git branch, session, token/context, model, and thinking information. It uses a gray `•` separator and shows Remote Pi/Subagents only when those extensions publish status. Restart Pi or run `/reload` after copying. Existing config is intentionally never overwritten automatically.

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

The copy command replaces an existing `pi-footer.json`; review or back it up first. Only one footer-replacement extension should be enabled at a time. Use `/footer` for interactive changes.

Pi 0.84.1 or newer should use native `fullscreen` TUI mode.

### Hindsight memory server

`@luxusai/pi-hindsight` is enabled by the aggregate, but automatic memory network I/O stays behind its setup gate until a server and coding bank are configured. Run `/hindsight` for guided setup. Prefer a self-hosted, authenticated endpoint reachable only over Tailscale or another private network; use one shared coding bank with stable project tags for cross-host development, and keep user memory disabled unless explicitly needed.

### Remote Pi trust boundary

Configure `REMOTE_PI_RELAY` to a private relay, preferably reachable only through Tailscale or another private network, **before** first running `/remote-pi`. TLS/Tailscale protects traffic in transit but the relay process can read routed content; `remote-pi@0.7.0` is not end-to-end encrypted.

Known accepted `0.7.0` limitations: pairing URI/token data is persisted in Pi session data and may enter model context during its short validity window; local broker/supervisor IPC trusts processes running as the same OS user; cancelling first-time setup can retain its cwd lock until Pi exits. Do not use the public relay or run untrusted local processes if those boundaries are unacceptable.

See the [repository README](https://github.com/HerbertGao/pi-extensions#readme) for the complete package list and provenance.

## License

[MIT](LICENSE). Bundled upstream notices are included in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
