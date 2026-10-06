---
"@herbertgao/pi-cc-extensions": patch
"@herbertgao/sol-pi": patch
---

Keep ccstyle write rich diffs when Action Fusion owns the write tool. Capture the bounded previous-file metadata inside Pi's mutation queue while retaining fused follow-up commands, file URL paths, and cancellation checks. Expanded edit/write diffs also retain sanitized follow-up command output. Third-party writers without the collaboration hook and custom write operations retain the existing ownership warning and fallback.
