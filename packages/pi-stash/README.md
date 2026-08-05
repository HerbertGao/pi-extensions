# @herbertgao/pi-stash

> HerbertGao-maintained fork of [@tifan/pi-stash](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-stash), distributed under MIT with the original attribution preserved.

Stash one draft, send another message, and return to the draft while pi works.

## Install

```bash
pi install npm:@herbertgao/pi-stash
```

## Keybinding

pi-stash overrides Pi's built-in `Ctrl+S` shortcuts. Remap them in `$PI_CODING_AGENT_DIR/keybindings.json` (default: `~/.pi/agent/keybindings.json`), then run `/reload`:

```json
{
  "app.models.save": ["ctrl+shift+s"],
  "app.session.toggleSort": ["ctrl+shift+s"]
}
```

## Usage

Press `Ctrl+S` with text in the editor to stash it. Pi clears the editor so you can send another message, then restores the draft as soon as that message is submitted.

Press `Ctrl+S` again while the editor is empty to restore the draft manually. If the editor contains new text, pi-stash keeps both drafts unchanged and refuses to overwrite either one.

The stash belongs to the current session and survives reloads and restarts. Slash commands and `!` shell commands do not consume it.

## License

[MIT](LICENSE)
