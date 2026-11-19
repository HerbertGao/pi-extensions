---
"@herbertgao/pi-extensions": patch
---

Raise the promoted dependency floors to what the bundled packages require: `nanoid@^5.1.16`, `turndown@^7.2.4`, and `undici@^8.12.3`. The installed versions already meet these floors, so this changes no resolved package today; it removes ranges that could resolve below a bundled package's own requirement, including the patched `undici` floor `pi-antigravity` needs.
