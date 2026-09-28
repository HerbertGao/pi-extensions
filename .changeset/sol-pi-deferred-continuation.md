---
"@herbertgao/sol-pi": patch
---

Stop reporting "Online context compact continuation did not start" after every online compaction on Pi 0.87, which defers `agent_settled` follow-up turns and awaits them itself.
