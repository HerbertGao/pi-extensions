---
"@herbertgao/sol-pi": patch
---

Sync upstream Pi 1.x and codemode compatibility fixes: preserve fused edit details on command failures, inherit trusted Pi shell settings, leave nested structured results intact, and preserve system-message positions during observation packing. Correct compaction projection, request accounting, and failure continuation. Keep `update_plan` declared to the model in codemode-only mode and disallow calling it from codemode scripts so completion boundaries remain visible to Online Context Compact.
