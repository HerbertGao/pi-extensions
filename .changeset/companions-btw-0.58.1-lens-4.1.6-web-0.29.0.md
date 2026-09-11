---
"@herbertgao/pi-extensions": patch
---

Advance bundled companion pins:

- `@narumitw/pi-btw@0.58.1`: honor the API base URL returned by Pi's authentication resolver for both inherited and explicitly configured side-thread models, fixing GitHub Copilot requests routed to a different endpoint.
- `pi-lens@4.1.6`: fold `lsp_diagnostics` into `lens_diagnostics` with `source=lsp` (the MCP surface keeps a one-release compatibility shim), unify Pi/MCP result rendering, add per-tool `enabled` configuration, and improve LSP cwd/root resolution plus Windows and runner fixes.
- `pi-web-access@0.29.0`: add SerpApi Google search, a self-hosted Crawl4AI extraction fallback, SOCKS proxy support, and 1Password service-account credentials; load extraction and AI features on demand; fix provider fallback, cache pruning, credential routing, and default web-search config discovery.
