---
"@herbertgao/pi-cc-extensions": minor
"@herbertgao/pi-extensions": patch
---

Port `pi-cc-extensions` 0.8.69: separate `expandedInputMaxLines` (default 5) and `expandedOutputMaxLines` (default 10) config fields so tool card Input and Output sections can be capped independently; the show-more "… +N more lines • click to show more" hint moves to the truncated tail line instead of the section header; double-click collapse now uses a mouseup-arm/unarm pattern to prevent terminals that emit synthetic press events from misidentifying a single click as a double click; Pi 0.85's official "Jump to latest" overlay is suppressed when the local scroll-to-bottom button is active to avoid two overlapping controls. Advance companion `@narumitw/pi-btw` pin to 0.57.0 (adds a themed, clickable Jump to latest control).
