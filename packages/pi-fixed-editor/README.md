# @herbertgao/pi-fixed-editor

> [!WARNING]
> This package is deprecated for Pi 0.84.1 and newer. Use [Pi's native fullscreen mode](https://pi.dev/docs/latest/settings#ui-display) instead. Support for older Pi versions is frozen.

## Migrate to native fullscreen

Remove this package:

```bash
pi remove npm:@herbertgao/pi-fixed-editor
```

Then enable fullscreen mode in one of these ways:

- Open `/settings` and set **TUI mode** to `fullscreen`.
- Add `"tuiMode": "fullscreen"` to `~/.pi/agent/settings.json`.
- Start Pi with `pi --tui-mode fullscreen`.

Native fullscreen keeps the editor, status, widgets, and footer fixed while the transcript scrolls.

## Legacy support

On Pi versions before 0.84, the extension continues to provide its existing fixed-editor behavior, including reduced streaming repaint. No further fixes are planned.

```bash
pi install npm:@herbertgao/pi-fixed-editor
```

Pi 0.84.0 users should upgrade to Pi 0.84.1 or newer and use native fullscreen mode.

## Credits

Originally derived from [`@tifan/pi-fixed-editor`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-fixed-editor). Fixed terminal-region behavior is adapted from [pi-powerline-footer](https://github.com/nicobailon/pi-powerline-footer) by Nico Bailon.

## License

[MIT](LICENSE)
