---
"@herbertgao/pi-extensions": minor
---

Replace bundled `pi-antigravity` with `@estebanforge/pi-antigravity-bridge@1.13.1`, which uses the official `agy` CLI (`agy acp` by default) instead of direct Cloud Code Assist OAuth. Antigravity models stay under `antigravity/*`; configure the bridge with `/agy`. Install and authenticate `agy` on the host before using the provider.
