---
"@herbertgao/pi-extensions": minor
---

Remove the bundled `@luxusai/pi-hindsight` dependency.

Automatic memory network I/O proved cost-inefficient under continuous agent workloads, with high write volume and client timeout issues under large memory node counts.

- Drop `@luxusai/pi-hindsight`, `@vectorize-io/hindsight-client`, and `jsonc-parser` from aggregate dependencies, bundled dependencies, Pi extension entries, and Pi skill entries; remove its pin from `upstreams.json`.
- Remove the aggregate assertions that verified its bundled manifest, license, third-party notices, extension entries, and skills.
- Remove the Hindsight memory server documentation and third-party notices.
