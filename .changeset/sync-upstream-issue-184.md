---
"@herbertgao/pi-cc-extensions": patch
"@herbertgao/pi-extensions": patch
---

Sync reviewed upstream companion packages and port `pi-cc-extensions` 0.8.71:

- Port `pi-cc-extensions` 0.8.71: render Pi omission markers in line-number gutters with `⋮`, omit trailing terminal markers, and restore official fullscreen scroll-to-end button when `/ccstyle off` or on teardown.
- Advance bundled companion pins:
  - `@dietrichgebert/ponytail@4.10.0`: assets and runtime hooks updates.
  - `@juicesharp/rpiv-ask-user-question@2.10.1`: option list and tab bar view refinements.
  - `@pi-plugins/fast-mode@0.1.12`: schema and match helpers update.
  - `@tifan/pi-copy-response@0.2.7`, `@tifan/pi-inline-skills@1.0.6`, `@tifan/pi-mermaid-open@0.2.1`, `@tifan/pi-preferred-thinking@1.0.2`, `@tifan/pi-recap@0.4.7`: latest bugfixes and compatibility maintenance.
  - `pi-mcp-adapter@2.34.0`: add plugin loaders, auth flow enhancements, and dependency updates.
