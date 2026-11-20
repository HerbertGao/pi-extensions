# @herbertgao/pi-inline-skill-commands

## 0.2.0

### Minor Changes

- [#404](https://github.com/HerbertGao/pi-extensions/pull/404) [`f7e030f`](https://github.com/HerbertGao/pi-extensions/commit/f7e030f578bb73f401d74fa4bac2b67947bc997a) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Name a fresh session with the prompt you typed instead of the expanded skill block, and add `/resume-session-name` to rebuild that name for sessions that already stored a block.

## 0.1.1

### Patch Changes

- [#388](https://github.com/HerbertGao/pi-extensions/pull/388) [`77a7633`](https://github.com/HerbertGao/pi-extensions/commit/77a7633b71ce4ffe288fde8c7a4e00786e27c81d) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Render mid-prompt `/skill:name` expansion as Pi's collapsed skill invocation block so it matches a start-of-prompt command, keeping the original sentence, command included, as the user message.

## 0.1.0

### Minor Changes

- [#384](https://github.com/HerbertGao/pi-extensions/pull/384) [`973a788`](https://github.com/HerbertGao/pi-extensions/commit/973a7885e327fa65039cd144bbb236ba1a83010c) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Add standalone mid-prompt autocomplete and expansion for native `/skill:name` commands without adding duplicate `/<name>` aliases.
