---
"@herbertgao/pi-cc-extensions": patch
---

Port reviewed upstream 0.9.6–0.9.9 fixes: stop the working-message refresh timer on a stale ctx instead of crashing Pi, preserve POSIX path separators, and yield the rich write diff with a one-time notice when another extension owns `write`.
