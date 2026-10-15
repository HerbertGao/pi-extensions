---
"@herbertgao/pi-extensions": patch
"@herbertgao/pi-cc-extensions": patch
"@herbertgao/pi-agency": patch
"@herbertgao/pi-bark": patch
"@herbertgao/pi-subagents": patch
"@herbertgao/sol-pi": patch
---

Stop bundling resume-from and lower the Node engines floor to `>=22.19.0`, matching Pi. Node 24 was copied from resume-from's engines field; these packages do not use a Node 24-only API. Pi's bundled Node 22 can install the current release instead of silently selecting an older one.
