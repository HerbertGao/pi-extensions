# @herbertgao/pi-extensions

Aggregate installer for HerbertGao-maintained Pi extensions and pinned upstream companions.

## Install

```bash
pi install npm:@herbertgao/pi-extensions
```

The package bundles 11 active `@herbertgao/*` child packages, including `@herbertgao/pi-cc-extensions`, plus the following upstream packages under their original names:

- `@dietrichgebert/ponytail@4.9.0`
- `@juicesharp/rpiv-ask-user-question@2.4.0`
- `@narumitw/pi-btw@0.50.0`
- `@pi-plugins/fast-mode@0.1.9`
- `pi-mcp-adapter@2.23.0`
- `pi-lens@3.8.74`
- `pi-web-access@0.22.0`
- `remote-pi@0.7.0`
- `@czottmann/pi-automode@1.11.0`

Pi loads their extensions and skills through `node_modules/` paths inside one package root. The upstream companions are pinned and bundled, not forked or renamed.

Pi 0.84.1 or newer should use native `fullscreen` TUI mode. The deprecated `@herbertgao/pi-fixed-editor` legacy package is intentionally not bundled.

### Remote Pi trust boundary

Configure `REMOTE_PI_RELAY` to a private relay, preferably reachable only through Tailscale or another private network, **before** first running `/remote-pi`. TLS/Tailscale protects traffic in transit but the relay process can read routed content; `remote-pi@0.7.0` is not end-to-end encrypted.

Known accepted `0.7.0` limitations: pairing URI/token data is persisted in Pi session data and may enter model context during its short validity window; local broker/supervisor IPC trusts processes running as the same OS user; cancelling first-time setup can retain its cwd lock until Pi exits. Do not use the public relay or run untrusted local processes if those boundaries are unacceptable.

See the [repository README](https://github.com/HerbertGao/pi-extensions#readme) for the complete package list and provenance.

## License

[MIT](LICENSE)
