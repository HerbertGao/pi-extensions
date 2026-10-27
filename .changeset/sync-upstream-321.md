---
"@herbertgao/pi-extensions": patch
---

Update pinned companions to pi-btw 0.63.1, pi-caffeinate 0.49.13, and pi-web-access 0.45.0. pi-btw opens its side workspace through the pi-tui-kit fullscreen handoff and does not start that UI after the flow is already disposed. pi-caffeinate requires dbus-native ^0.16.2 so a Bun D-Bus reader thread can be unreferenced. Web Access keeps field extraction, 9router, and plain HTTP gateways off unless configured. An unknown search provider name now fails instead of falling back to automatic selection, and DuckDuckGo searches stay spaced apart after a bot check.
