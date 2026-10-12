---
"@herbertgao/pi-cc-extensions": minor
"@herbertgao/pi-extensions": patch
---

Replay `@herbertgao/pi-cc-extensions` onto upstream v1.0.1 (`0188b76`). Bring in footer currency and Git status, token rate and TTFT, sticky user prompts, ask-user-question rendering, summary-only edit previews, and shell durations. Existing `inputClip` settings are still read as `toolLabelClip`; `scrollStepLines` is removed. Keep the scoped package identity, Action Fusion write-diff cooperation, and the guard that ignores provider error usage. No installed configuration, credentials, or sessions are migrated.
