# @herbertgao/pi-preferred-thinking

> HerbertGao-maintained fork of [@tifan/pi-preferred-thinking](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-preferred-thinking), distributed under MIT with the original attribution preserved.

Set and apply per-model thinking levels from Pi's native `enabledModels` setting.

## Install

```bash
pi install npm:@herbertgao/pi-preferred-thinking
```

This package requires Pi 0.84.2 or newer.

## How it works

Run `/preferred-thinking` to choose a thinking level for the current model. The
extension writes the model pin to Pi's `settings.json` and reloads Pi so the
native model scope uses it.

When Pi selects a scoped model, the extension applies its native thinking pin.
It also applies the pin when the model picker is used, which keeps model cycling
and model selection consistent.

If a reasoning model has no saved pin, the extension shows a short hint above
the editor. It does not change the current thinking level in that case.

## Configuration

Add models to Pi's `enabledModels` setting. The extension preserves other
entries and updates only the selected model:

```json
{
  "enabledModels": [
    "openai-codex/gpt-5.6-luna:xhigh",
    "openai-codex/gpt-5.6-terra:high"
  ]
}
```

The extension requires `enabledModels` to exist before it can save a pin. If
the selected model is not listed, it adds an exact entry without removing other
models or patterns.

The old `~/.config/pi/extensions/pi-preferred-thinking.json` file is no longer
read. Existing users must move preferences to `enabledModels` or set them with
`/preferred-thinking`.

## Release notes

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
