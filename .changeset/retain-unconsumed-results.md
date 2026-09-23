---
"@herbertgao/pi-subagents": patch
---

Retain completed subagent results until they are consumed, including when cleanup runs after ten minutes.

Fix a separate Pi 0.87 compatibility issue in mention clones: restore history through SessionManager and provide the live prompt through the before_agent_start hook instead of writing getter-only agent state.
