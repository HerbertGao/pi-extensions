# @herbertgao/pi-stash

> HerbertGao-maintained fork of [@tifan/pi-stash](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-stash), distributed under MIT with the original attribution preserved.

Stash one draft, send another message, and return to the draft while pi works.

## Install

```bash
pi install npm:@herbertgao/pi-stash
```

## Keybinding

pi-stash uses `Alt+S`, which does not conflict with Pi's built-in shortcuts.

### macOS

On macOS, press `Option+S` (`Option` is the `Alt` key). If that inserts `ß` instead of triggering pi-stash, configure the terminal to send `Option` as Meta/Escape:

- Terminal.app: **Settings → Profiles → Keyboard → Use Option as Meta key**.
- iTerm2: **Settings → Profiles → Keys → Left Option key** (or **Right Option key**) → **Esc+**.

## Usage

Press `Alt+S` with text in the editor to stash it. Pi clears the editor so you can send another message, then restores the draft as soon as that message is submitted.

Press `Alt+S` again while the editor is empty to restore the draft manually. If the editor contains new text, pi-stash keeps both drafts unchanged and refuses to overwrite either one.

The stash belongs to the current session and survives reloads and restarts. Slash commands and `!` shell commands do not consume it.

## License

[MIT](LICENSE)
