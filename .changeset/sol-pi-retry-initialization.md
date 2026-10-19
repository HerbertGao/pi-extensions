---
"@herbertgao/sol-pi": patch
---

Allow SoL-Pi initialization to retry on the next session after configuration loading fails. Malformed shell settings still report an error, but repairing them no longer leaves all enabled features permanently unregistered.
