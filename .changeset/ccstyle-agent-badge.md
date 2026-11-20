---
"@herbertgao/pi-cc-extensions": patch
"@herbertgao/pi-subagents": patch
"@herbertgao/pi-extensions": patch
---

Color the ccstyle Agent tool rows with each type's configured badge. pi-subagents exposes the label and color of every spawnable type over a new `subagents:rpc:list-agents` bus channel and announces registry changes with a `subagents:agents-changed` event; pi-cc-extensions pulls the table on `subagents:ready` and renders Agent rows as padded background badges (same palette, hex, 256-color quantization, and contrast rules as pi-subagents' own badges). Without pi-subagents on the bus the rows stay plain text.
