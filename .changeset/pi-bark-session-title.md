---
"@herbertgao/pi-bark": minor
---

Add opt-in session titles and short-run silence, and notify on every blocking prompt.

- `title.source: "session"` titles the notification with the session (Pi's session name, else the first user message) and moves the event state to the body, so several running agents are distinguishable from the lock screen. `title.maxLength` bounds it and defaults to `40`. The default `"fixed"` keeps today's localized copy.
- `minDurationMs` (default `0`) skips the settle notification for runs that finish faster, so one-line replies stop producing notification noise. The needs-input notification is never suppressed.
- Needs-input notifications now come from Pi's generic `ui_prompt_start` event, so approvals, selects, inputs, and custom panels notify too, not only `ask_user_question`. `events.askUserQuestion` is still honored as an alias for the new `events.needsInput`.
- Settle notifications now await the request instead of firing and forgetting, so a settle that races process shutdown still delivers.
