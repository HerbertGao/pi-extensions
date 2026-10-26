---
"@herbertgao/pi-extensions": patch
---

Update pinned companions to ask-user-question 2.15.0 (with rpiv-config ^2.15.0), pi-btw 0.63.0, pi-lens 4.4.5, pi-next-cue 1.0.8, and pi-typesafe 0.13.0. Ask can open notes with a configurable key, including a single non-Latin character. pi-btw imports new main-thread context only after an explicit shortcut and confirmation. pi-lens flags concatenated SQL passed to execute as advisory and promotes ast-grep to 0.51.0. pi-typesafe follows PI_TYPESAFE_BACKEND and PI_TYPESAFE_MODEL, stores a separate key per backend, and uses @typesafe-ai/sdk 0.7.0. The default backend remains the TypeSafe API. pi-next-cue 1.0.8 requires Pi >=1.2.0 and does not change its prompt prediction behavior.
