---
"@herbertgao/pi-agency": patch
"@herbertgao/pi-subagents": patch
"@herbertgao/pi-extensions": patch
---

Give registered personas the tools their job needs. `agency_register` and `subagents:rpc:register-agents` now accept `tools: "all" | "builtin" | "none"` plus an optional `extensions` allowlist, defaulting to `"all"` — a seated persona inherits the session's extensions and skills the way `general-purpose` does, so a research expert keeps `web_search`, `fetch_content`, and MCP instead of silently degrading to `bash` and `curl`. `tools: "none"` still gives advisory seats a structurally empty tool surface, and `extensions: ["pi-web-access"]` narrows the inherited set.
