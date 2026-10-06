# @herbertgao/pi-bark

## 0.2.0

### Minor Changes

- [#256](https://github.com/HerbertGao/pi-extensions/pull/256) [`ab02b7b`](https://github.com/HerbertGao/pi-extensions/commit/ab02b7b2115bd9cc409f8d68c804e0cf6e76f6e1) Thanks [@svipm](https://github.com/svipm)! - Add opt-in session titles and short-run silence, and notify on every blocking prompt.

  - `title.source: "session"` titles the notification with the session (Pi's session name, else the first user message) and moves the event state to the body, so several running agents are distinguishable from the lock screen. `title.maxLength` bounds it and defaults to `40`. The default `"fixed"` keeps today's localized copy.
  - `minDurationMs` (default `0`) skips the settle notification for runs that finish faster, so one-line replies stop producing notification noise. The needs-input notification is never suppressed.
  - Needs-input notifications now come from Pi's generic `ui_prompt_start` event, so approvals, selects, inputs, and custom panels notify too, not only `ask_user_question`. `events.askUserQuestion` is still honored as an alias for the new `events.needsInput`.
  - Settle notifications now await the request instead of firing and forgetting, so a settle that races process shutdown still delivers.

### Patch Changes

- [#256](https://github.com/HerbertGao/pi-extensions/pull/256) [`6ff0033`](https://github.com/HerbertGao/pi-extensions/commit/6ff003379940891ea8d5c6d991a0ab6bd86069bf) Thanks [@svipm](https://github.com/svipm)! - Cancel pending input alerts when a prompt, run, or session ends, and avoid notifications for unsupported or quickly closed UI calls. Keep native dialogs distinct from questionnaire fallback duplicates and truncate session titles within their configured Unicode character limit.

## 0.1.4

### Patch Changes

- [#248](https://github.com/HerbertGao/pi-extensions/pull/248) [`c14c004`](https://github.com/HerbertGao/pi-extensions/commit/c14c0042a8e02862cd6718dd60e4ffb22314165c) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Use Pi 0.99+'s native MCP implementation instead of registering the removed `pi-mcp-adapter`, declare Pi-hosted packages as wildcard peers, update `@tifan/pi-handoff` to 2.2.2 for its Herdr startup retry fix, and pin `pi-typesafe` to 0.8.0.

## 0.1.3

### Patch Changes

- [#232](https://github.com/HerbertGao/pi-extensions/pull/232) [`9c3c40f`](https://github.com/HerbertGao/pi-extensions/commit/9c3c40f113c62437f76d300042fc59fbf15954c0) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Require the unified Pi 0.87.1 dependency line across published packages.

## 0.1.2

### Patch Changes

- [#219](https://github.com/HerbertGao/pi-extensions/pull/219) [`6525a59`](https://github.com/HerbertGao/pi-extensions/commit/6525a5995b8bb815517e326f1eef78d25c0a3c5e) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Bundle `pi-multi-account@1.22.0` for automatic multi-account failover and rotation across supported Pi providers. Update the aggregate host to Pi 0.85.1 and widen the maintained child package compatibility ranges.

## 0.1.1

### Patch Changes

- [#210](https://github.com/HerbertGao/pi-extensions/pull/210) [`fb69760`](https://github.com/HerbertGao/pi-extensions/commit/fb69760aebf11ec94970bd85ca50bd750b4adb5a) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Bundle `pi-typesafe@0.5.0` and `pi-jev-auto-mode@0.4.1`, and raise the aggregate Pi baseline to 0.85.1 for their peer requirements. Broaden the maintained child packages' Pi 0.84/0.85 compatibility ranges so they remain installable in the upgraded aggregate.
