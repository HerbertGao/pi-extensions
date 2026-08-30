# @herbertgao/pi-bark

Bark notifications for user-facing Pi sessions. It sends a notification when Pi fully settles and when [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono) opens a questionnaire. Requests follow Bark's official [POST form API](https://github.com/Finb/Bark/blob/master/docs/en-us/tutorial.md#request-methods).

## Install

```bash
pi install npm:@herbertgao/pi-bark
```

The extension is also included in `@herbertgao/pi-extensions`.

## Configure

Create `$PI_CODING_AGENT_DIR/bark.json` (normally `~/.pi/agent/bark.json`):

```json
{
  "endpoint": "https://api.day.app/your-device-key",
  "machine": "MacBook Pro M1 Max",
  "locale": "zh-CN",
  "events": {
    "agentSettled": true,
    "askUserQuestion": true
  },
  "params": {
    "group": "pi",
    "icon": "https://raw.githubusercontent.com/HerbertGao/pi-extensions/master/packages/pi-bark/assets/pi-icon.png"
  },
  "timeoutMs": 4000
}
```

`endpoint` is required. `locale` accepts `auto` (default), `zh-CN`, `zh-TW`, or `en`; unsupported languages fall back to English. `params` accepts additional Bark POST parameters such as `group`, `sound`, `icon`, and `level`; dynamic `title` and `body` values always take precedence. Set `"enabled": false` to disable all notifications without removing the package.

The notification body uses `💻` for the configured machine name and `📁` for Pi's full working directory. Questionnaire text is intentionally not sent because it may contain sensitive context. Only sessions with a user-facing UI notify, so nested `pi-subagents` sessions do not create duplicate pushes.

The bundled [`assets/pi-icon.png`](assets/pi-icon.png) is a 512×512 rasterization of Pi's official [square badge](https://pi.dev/favicon.svg) from the [Pi Press Kit](https://pi.dev/press-kit), suitable for Bark's iOS 15+ `icon` parameter.

Keep `bark.json` private because the endpoint normally contains the Bark device key. Restart Pi or run `/reload` after changing it.

## License

[MIT](LICENSE)
