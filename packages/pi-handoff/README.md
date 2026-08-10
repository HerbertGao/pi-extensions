# @herbertgao/pi-handoff

> HerbertGao-maintained fork of [@tifan/pi-handoff](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-handoff), distributed under MIT with the original attribution preserved.

Start a fresh pi session from a handoff document, and query past sessions for context, decisions, or code changes.

## Install

```bash
pi install npm:@herbertgao/pi-handoff
```

For local development:

```bash
pi install /absolute/path/to/pi-extensions/packages/pi-handoff
```

You also need a `handoff` skill installed and discoverable by pi. For example, install or expose Matt Pocock's `handoff` skill, then run `/reload`.

## How it works

Run `/handoff-session` to generate a handoff document from the current session and start a clean session from it. The command asks what the next session is for, uses the installed `handoff` skill as the document policy, and writes the handoff under the OS temp directory.

The new session name is generated from the current conversation using pi-rename-style rules: lowercase, hyphen-separated, and under 60 characters. Naming uses `openai-codex/gpt-5.6-luna` when available, with a local fallback. The focus answer is used for the handoff document, not for the session name. The prompt is left in the editor for review and manual submit.

The handoff includes the previous session path when available, so the next agent can use `session_query` if the handoff omits a detail.

## Commands

- `/handoff-session`: Generate a handoff from the current session and start a renamed session from it.

## Tools

- `session_query`: Answer a question about a previous pi session, given the full path to its `.jsonl` file and the question to ask.

## Behavior

- Uses the current selected model to generate the handoff document.
- Uses `openai-codex/gpt-5.6-luna` to name the new pi session when available.
- Requires a discoverable skill named exactly `handoff`.
- Writes stable, readable files under the OS temp directory, such as `/tmp/pi-handoffs/pi-handoff-2026-06-01-inline-skills.md`.
- Starts a clean session with native parent-session linking.
- Does not autosend.

## Release notes

See [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE)
