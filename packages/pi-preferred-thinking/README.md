# @herbertgao/pi-preferred-thinking

> HerbertGao-maintained fork of [@tifan/pi-preferred-thinking](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-preferred-thinking), distributed under MIT with the original attribution preserved.

Apply per-model thinking levels from `~/.config/pi/extensions/pi-preferred-thinking.json` when sessions start or models change.

This extension is for model-specific preferences. Pi's built-in `defaultThinkingLevel` remains global, while `preferredThinking` lets you choose different levels for different models. Invalid or missing values are ignored.

![Preferred thinking picker showing model-specific thinking levels](https://raw.githubusercontent.com/tifandotme/pi-extensions/refs/heads/master/packages/pi-preferred-thinking/assets/picker.webp)

## Install

```bash
pi install npm:@herbertgao/pi-preferred-thinking
```

## Configuration

Run `/preferred-thinking` to set or unset the preferred thinking level for the current model.

Valid levels: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.

The extension saves preferences in `~/.config/pi/extensions/pi-preferred-thinking.json`:

```json
{
  "preferredThinking": {
    "anthropic/claude-opus-4-8": "high",
    "openai-codex/gpt-5.6-luna": "minimal"
  }
}
```

## Release notes

See [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE)
