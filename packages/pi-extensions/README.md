# @herbertgao/pi-extensions

Aggregate installer for HerbertGao-maintained Pi extensions and pinned upstream companions.

## Install

```bash
pi install npm:@herbertgao/pi-extensions
```

The package bundles 11 active `@herbertgao/*` child packages, including `@herbertgao/pi-cc-extensions`, plus the following upstream packages under their original names:

- `@juicesharp/rpiv-ask-user-question@2.4.0`
- `pi-mcp-adapter@2.21.2`
- `pi-lens@3.8.74`
- `pi-web-access@0.18.0`
- `@czottmann/pi-automode@1.11.0`

Pi loads their extensions and skills through `node_modules/` paths inside one package root. The upstream companions are pinned and bundled, not forked or renamed.

Pi 0.84.1 or newer should use native `fullscreen` TUI mode. The deprecated `@herbertgao/pi-fixed-editor` legacy package is intentionally not bundled.

See the [repository README](https://github.com/HerbertGao/pi-extensions#readme) for the complete package list and provenance.

## License

[MIT](LICENSE)
