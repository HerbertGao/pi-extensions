# @herbertgao/pi-handoff

> HerbertGao-maintained fork of [@tifan/pi-handoff](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-handoff), distributed under MIT with the original attribution preserved.

Start a fresh pi session from a handoff document, and query past sessions for context, decisions, or code changes.

## Install

```bash
pi install npm:@herbertgao/pi-handoff
```

## Requirements

Matt Pocock's [`handoff` skill](https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md) is required:

```bash
npx skills add https://github.com/mattpocock/skills --global --skill handoff
```

## How it works

Submit a prompt containing a standalone `-handoff` marker to generate a handoff document from the current session and automatically start a clean session from it. The marker can appear anywhere in the prompt. The handoff is written under the OS temp directory.

The new session name uses the current session name when available. Otherwise, it uses the next-session focus, sanitized to lowercase, hyphen-separated text under 60 characters.

The handoff includes the previous session path when available, so the next agent can use `session_query` if the handoff omits a detail.

## Usage

```text
fix the auth flow -handoff
```

The standalone `-handoff` marker is consumed before the prompt reaches the agent. The text before and after it becomes the next-session focus. A prompt containing only `-handoff` continues the current work.

## `session_query`

`session_query`: Answer a question about a previous pi session, given the full path to its `.jsonl` file and the question to ask. It uses the configured `openai-codex/gpt-5.6-luna` model, which must be available and authenticated.

Pi provides session loading and compaction-aware context reconstruction, but not semantic questions about an arbitrary previous session. `session_query` supplies that model-powered query layer.

## Release notes

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
