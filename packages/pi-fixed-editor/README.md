# @herbertgao/pi-fixed-editor

> HerbertGao-maintained fork of [@tifan/pi-fixed-editor](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-fixed-editor), distributed under MIT with the original attribution preserved.

Keep Pi's editor, footer, and editor-adjacent widgets fixed at the bottom of the terminal while the transcript scrolls.

## Install

```bash
pi install npm:@herbertgao/pi-fixed-editor
```

## What it does

- Pins Pi's existing editor/footer area to the bottom of the terminal.
- Keeps `aboveEditor` and `belowEditor` widgets with the editor.
- Preserves existing editor behavior, footer content, and autocomplete.
- Routes mouse wheel and PageUp/PageDown scrolling to the transcript.
- Jumps the transcript back to the bottom when you submit a query with Enter.

## What it does not do

- No styling.
- No powerline footer.
- No commands.
- No settings.
- No custom shortcuts.
- No print or RPC mode behavior.

Uninstall or disable the extension to return to Pi's default scrolling behavior.

## Credits

Fixed terminal-region behavior is adapted from [pi-powerline-footer](https://github.com/nicobailon/pi-powerline-footer) by Nico Bailon.

## License

[MIT](LICENSE)
