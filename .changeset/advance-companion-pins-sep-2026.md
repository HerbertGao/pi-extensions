---
"@herbertgao/pi-extensions": patch
---

Advance companion pins for `@pi-plugins/fast-mode` to `0.1.11` and `pi-web-access` to `0.28.0`.

- `@pi-plugins/fast-mode@0.1.11`: adds GPT-6 Astra to the default fast-mode model list for the OpenAI and OpenAI Codex providers; no API or behaviour change for other providers.
- `pi-web-access@0.28.0`: adds opt-in X post search (xAI), Mistral web search, parallel batch search with concurrency limit, `responseId` in search output for stored-result retrieval, Perplexity now keeps all cited sources, configured proxies are now scoped to web-tool requests only, abandoned GitHub clone directories are cleaned up after crashes, and `~/.pi/web-search.json` is respected when `XDG_CONFIG_HOME` is set but no config exists there.
