---
"@herbertgao/pi-extensions": patch
---

Resolve dbus-native to 0.16.3. Closing a D-Bus connection whose socket is already gone stops a pending reconnect, and a failed Hello tears the transport down instead of throwing from the reply callback.
