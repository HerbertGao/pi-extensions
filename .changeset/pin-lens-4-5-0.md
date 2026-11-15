---
"@herbertgao/pi-extensions": patch
---

Pin pi-lens 4.5.0. An async array callback with a block body is not flagged for a missing return. A sync block callback that does not return still is. A check that did not finish is not reported as clean.
