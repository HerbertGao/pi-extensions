---
"@herbertgao/pi-subagents": minor
"@herbertgao/pi-extensions": patch
---

Rebase `@herbertgao/pi-subagents` onto upstream v0.20.0 (`13106ab`) and adopt upstream's own mention-clone rewrite: the clone takes its history through `SessionManager.inMemory` and receives the live system prompt through a `DefaultResourceLoader` override instead of the previous context-projection path. The local behavior that hands the spawn the main session's context augmented with the clone's `tools` and `executeTool` is retained, so mentioned agents keep Pi 1.x tool-call capabilities while staying attributed to the main session.

Two local patches remain because their upstream pull requests are still open: preserving a worktree when cleanup fails (`tintinweb/pi-subagents#268`, with the refused `--no-gpg-sign` preservation commit) and retaining unconsumed terminal results past the automatic cleanup timer (`tintinweb/pi-subagents#348`). Upstream now declares `typebox` as a host-provided peer and drops `@sinclair/typebox` from runtime dependencies. No installed configuration, credentials, or sessions are migrated.
