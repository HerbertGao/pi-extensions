---
"@herbertgao/pi-extensions": minor
---

Remove `remote-pi` from the aggregate. The package is no longer bundled, registered as a Pi extension, or tracked as an upstream companion; its exclusive dependencies (`qrcode-terminal`, `@noble/ed25519`) and the remote-pi smoke checks are dropped with it. This also retires the documented Remote Pi trust-boundary exceptions (relay plaintext visibility, same-user IPC, pairing material in session data). Existing local installations keep running until the aggregate is upgraded; remove the supervisor service and `~/.pi/remote/` manually to fully uninstall.
