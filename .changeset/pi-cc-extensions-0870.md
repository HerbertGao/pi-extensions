---
"@herbertgao/pi-cc-extensions": patch
"@herbertgao/pi-extensions": patch
---

Port `pi-cc-extensions` 0.8.70: the rich-diff parser accepts Pi's space-delimited numbered rows only while no hunk header has been seen, so unified hunks keep numeric source content instead of treating it as a gutter, and Pi's blank-number `...` omission rows render as metadata without invented line numbers. Long path summaries are relativized against the tool cwd and middle-truncated so the filename stays visible in single-tool, tool-group, and compact edit/write summaries while keeping live-viewport clipping.
