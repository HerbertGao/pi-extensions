---
"@herbertgao/pi-extensions": patch
---

Pin pi-lens 4.4.6, pi-provider-qoder 0.6.6, and pi-typesafe 0.13.1. pi-lens refuses a workspace edit through a dangling symlink and drops the stale nursery rule from its fallback Biome config. Qoder reports a queued model-busy limit with its wait. TypeSafe replays a judge response body under Bun so the result stays readable.
