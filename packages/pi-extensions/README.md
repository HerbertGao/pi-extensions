# @herbertgao/pi-extensions

Aggregate installer for HerbertGao-maintained Pi extensions and pinned upstream companions.

## Install

```bash
pi install npm:@herbertgao/pi-extensions
```

The package bundles 11 active `@herbertgao/*` child packages, including `@herbertgao/pi-cc-extensions`, plus the following upstream packages under their original names:

- `@dietrichgebert/ponytail@4.9.0`
- `@juicesharp/rpiv-ask-user-question@2.5.2`
- `@narumitw/pi-btw@0.51.0`
- `@pi-plugins/fast-mode@0.1.9`
- `pi-mcp-adapter@2.26.0`
- `pi-footer@0.5.1`
- `pi-lens@4.0.0`
- `pi-web-access@0.22.0`
- `remote-pi@0.7.0`
- `@czottmann/pi-automode@1.11.0`

Pi loads their extensions and skills through `node_modules/` paths inside one package root. The upstream companions are pinned and bundled, not forked or renamed.

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

Pi 0.84.1 or newer should use native `fullscreen` TUI mode. The deprecated `@herbertgao/pi-fixed-editor` legacy package is intentionally not bundled.

### Remote Pi trust boundary

Configure `REMOTE_PI_RELAY` to a private relay, preferably reachable only through Tailscale or another private network, **before** first running `/remote-pi`. TLS/Tailscale protects traffic in transit but the relay process can read routed content; `remote-pi@0.7.0` is not end-to-end encrypted.

Known accepted `0.7.0` limitations: pairing URI/token data is persisted in Pi session data and may enter model context during its short validity window; local broker/supervisor IPC trusts processes running as the same OS user; cancelling first-time setup can retain its cwd lock until Pi exits. Do not use the public relay or run untrusted local processes if those boundaries are unacceptable.

See the [repository README](https://github.com/HerbertGao/pi-extensions#readme) for the complete package list and provenance.

## License

[MIT](LICENSE)
