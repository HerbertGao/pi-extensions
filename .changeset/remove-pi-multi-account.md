---
"@herbertgao/pi-extensions": minor
---

Remove the bundled `pi-multi-account` dependency.

Its automatic provider failover and local exhaustion cooldown can switch away from working accounts after a temporary quota hit, which is undesirable for this aggregate.

- Drop `pi-multi-account` from aggregate dependencies, bundled dependencies, and Pi extension entries; remove its pin from `upstreams.json`.
- Drop the promoted runtime dependencies it alone required: `@bufbuild/protobuf` and `proper-lockfile`.
- Remove the aggregate assertions that verified its bundled manifest, license, extension entry, and session cleanup handler.
- Remove its documentation and third-party notices.
