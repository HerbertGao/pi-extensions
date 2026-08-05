# @herbertgao/pi-extensions

Aggregate installer for HerbertGao-maintained Pi extensions and pinned upstream companions.

## Install

```bash
pi install npm:@herbertgao/pi-extensions
```

The package bundles 11 `@herbertgao/*` child packages plus the following upstream packages under their original names:

- `@juicesharp/rpiv-ask-user-question@2.4.0`
- `pi-mcp-adapter@2.19.0`
- `pi-lens@3.8.74`
- `pi-web-access@0.18.0`
- `@czottmann/pi-automode@1.9.0`

Pi loads their extensions and skills through `node_modules/` paths inside one package root. The upstream companions are pinned and bundled, not forked or renamed.

`@herbertgao/pi-cc-extensions` is not included yet because its upstream source has no explicit redistribution license.

See the [repository README](https://github.com/HerbertGao/pi-extensions#readme) for the complete package list and provenance.

## License

[MIT](LICENSE)
