---
"@herbertgao/pi-cc-extensions": patch
---

Match names in `excludeRenderers` without regard to case, highlight each side of a diff omission separately, and send writes through Pi's path handling so a WSL drive path lands on the real drive. A write that has already reached disk still reports success if the turn is aborted afterward.
