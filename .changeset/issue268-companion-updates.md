---
"@herbertgao/pi-extensions": patch
---

Upgrade the reviewed companion pins to Caffeinate 0.49.11, Pi-Lens 4.4.1, and Web Access 0.38.0. Caffeinate only makes the Linux D-Bus import tolerate a default-export namespace, so macOS behavior is untouched. Pi-Lens publishes a public LSP config schema, adds user-level custom rule directories (project before user before built-in), normalizes argv-style server entries, downgrades `throw-new-error` to a warning, and counts Docker, JSON, and Jedi servers in idle eviction. Web Access adds the explicit-only Ceramic provider, defaults OpenAI search to `gpt-6-luna`, allows keyless providers for answers and query rewriting, and scopes results and clone cleanup per extension instance. The promoted `@modelcontextprotocol/sdk` range moves from `^1.29.0` to `^1.32.1`, which also takes the bundle off GHSA-6qxp-vccf-f47h. No installed configuration, credentials, services, or sessions are migrated.
