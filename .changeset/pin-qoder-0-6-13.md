---
"@herbertgao/pi-extensions": patch
---

Pin pi-provider-qoder 0.6.13. A plan-disabled catalog model stays listed so a configured model still resolves, and auto stays hidden unless the server enables it. After login the provider refreshes that catalog, waiting at most 15 seconds, instead of keeping the static fallback until restart.
