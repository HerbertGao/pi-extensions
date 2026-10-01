# @herbertgao/pi-bark

Bark notifications for user-facing Pi sessions. It sends a notification when Pi fully settles and when Pi blocks on a user-facing dialog — an approval, a select, an input prompt, a custom panel, or an [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono) questionnaire. Requests follow Bark's official [POST form API](https://github.com/Finb/Bark/blob/master/docs/en-us/tutorial.md#request-methods).

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
    "needsInput": true
  },
  "params": {
    "group": "pi",
    "icon": "https://raw.githubusercontent.com/HerbertGao/pi-extensions/master/packages/pi-bark/assets/pi-icon.png"
  },
  "title": {
    "source": "session",
    "maxLength": 40
  },
  "minDurationMs": 30000,
  "timeoutMs": 4000
}
```

`endpoint` is required. `locale` accepts `auto` (default), `zh-CN`, `zh-TW`, or `en`; unsupported languages fall back to English. `params` accepts additional Bark POST parameters such as `group`, `sound`, `icon`, and `level`; dynamic `title` and `body` values always take precedence. Set `"enabled": false` to disable all notifications without removing the package. `events.needsInput` covers every blocking dialog; `events.askUserQuestion` is the older name and is still honored as an alias.

### Session titles

The default `title.source` is `"fixed"`, which keeps Pi's localized copy (`✅ Pi 跑完了` / `🟡 Pi 等你回答`) as the notification title. Set it to `"session"` to title the notification with the session instead — Pi's session name when one is set, otherwise the first user message, which is the label hosts such as Paseo already show for the session:

```json
{ "title": { "source": "session", "maxLength": 40 } }
```

`maxLength` defaults to `40` and the ellipsis counts toward it. With `"session"`, the event state moves to the first line of the body:

```
title:  Please reply with exactly the single wo…
body:   ✅ 已完成 · 用时 2m14s
        💻 MacBook Pro M1 Max
        📁 /Users/herbertgao/VSCodeProject/pi
```

The title is resolved when the notification is sent, so a session that is renamed or that has only just received its first message still gets the right one.

### Short runs

`minDurationMs` defaults to `0` (always notify). Raise it to skip the settle notification when the run finished faster, so one-line replies stop producing notification noise:

```json
{ "minDurationMs": 30000 }
```

The needs-input notification is never suppressed — that one always needs a person.

The notification body uses `💻` for the configured machine name and `📁` for Pi's full working directory. Questionnaire text is intentionally not sent because it may contain sensitive context. Only sessions with a user-facing UI notify, so nested `pi-subagents` sessions do not create duplicate pushes.

The bundled [`assets/pi-icon.png`](assets/pi-icon.png) is a 512×512 rasterization of Pi's official [square badge](https://pi.dev/favicon.svg) from the [Pi Press Kit](https://pi.dev/press-kit), suitable for Bark's iOS 15+ `icon` parameter.

Keep `bark.json` private because the endpoint normally contains the Bark device key. Restart Pi or run `/reload` after changing it.

## License

[MIT](LICENSE)
