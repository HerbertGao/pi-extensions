---
"@herbertgao/pi-extensions": patch
---

Advance `@tifan/pi-handoff` companion pin to `2.2.1`.

- New handoff sessions are prefixed `[handoff] ` in both the session name and the Herdr tab label, making them visually distinct.
- `tab create` no longer passes `--focus`; the current Herdr tab stays active while the handoff opens in a background tab.
