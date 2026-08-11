# @herbertgao/pi-extensions

A collection of HerbertGao-maintained and pinned upstream extensions for the [Pi coding agent](https://pi.dev).

## Install the collection

```bash
pi install npm:@herbertgao/pi-extensions
```

The aggregate package bundles the active maintained packages below plus the pinned upstream companions listed afterward, so Pi loads them from one isolated package root. Individual packages can also be installed separately. The deprecated fixed-editor package remains available only for legacy Pi versions and is not loaded by the aggregate.

## Packages

| Package                                                               | Description                                                                 | Source                                                                                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [`@herbertgao/pi-cc-extensions`](packages/pi-cc-extensions)           | Claude Code-style output, fullscreen interaction, context and references.   | [`pi-cc-extensions`](https://github.com/minuque/pi-cc-extensions)                                                        |
| [`@herbertgao/pi-copy-response`](packages/pi-copy-response)           | Pick and copy an assistant response.                                        | [`@tifan/pi-copy-response`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-copy-response)           |
| [`@herbertgao/pi-fixed-editor`](packages/pi-fixed-editor)             | Frozen legacy support for Pi versions before 0.84; not in the aggregate.    | [`@tifan/pi-fixed-editor`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-fixed-editor)             |
| [`@herbertgao/pi-handoff`](packages/pi-handoff)                       | Transfer session context and query past sessions.                           | [`@tifan/pi-handoff`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-handoff)                       |
| [`@herbertgao/pi-inline-skills`](packages/pi-inline-skills)           | Inline `/skill` autocomplete.                                               | [`@tifan/pi-inline-skills`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-inline-skills)           |
| [`@herbertgao/pi-mermaid-open`](packages/pi-mermaid-open)             | Extract and open Mermaid diagrams.                                          | [`@tifan/pi-mermaid-open`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-mermaid-open)             |
| [`@herbertgao/pi-preferred-thinking`](packages/pi-preferred-thinking) | Persist preferred thinking levels per model.                                | [`@tifan/pi-preferred-thinking`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-preferred-thinking) |
| [`@herbertgao/pi-recap`](packages/pi-recap)                           | Generate one-line session recaps.                                           | [`@tifan/pi-recap`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-recap)                           |
| [`@herbertgao/pi-rename`](packages/pi-rename)                         | Generate session names and rename Herdr tabs.                               | [`@tifan/pi-rename`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-rename)                         |
| [`@herbertgao/pi-stash`](packages/pi-stash)                           | Stash and restore one editor draft.                                         | [`@tifan/pi-stash`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-stash)                           |
| [`@herbertgao/pi-subagents`](packages/pi-subagents)                   | Autonomous subagents with HerbertGao's agent-name and color customizations. | [`@tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents)                                                   |
| [`@herbertgao/pi-titlebar-spinner`](packages/pi-titlebar-spinner)     | Show activity in the terminal titlebar.                                     | [`@tifan/pi-titlebar-spinner`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-titlebar-spinner)     |
| [`@herbertgao/pi-extensions`](packages/pi-extensions)                 | Aggregate installer for the collection.                                     | This repository                                                                                                          |

## Bundled upstream companions

These packages retain their original names and upstream maintainers. The aggregate package pins and bundles them; this repository does not fork or republish their source under `@herbertgao/*`.

| Package                                                                         | Pinned version | Purpose                         |
| ------------------------------------------------------------------------------- | -------------- | ------------------------------- |
| [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono) | `2.4.0`        | Structured user questionnaires. |
| [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter)                | `2.21.2`       | MCP tools and skills.           |
| [`pi-lens`](https://github.com/apmantza/pi-lens)                                | `3.8.74`       | Code diagnostics and skills.    |
| [`pi-web-access`](https://github.com/nicobailon/pi-web-access)                  | `0.18.0`       | Web search and content access.  |
| [`@czottmann/pi-automode`](https://github.com/czottmann/pi-automode)            | `1.11.0`       | Auto-mode guardrails.           |

## Native fullscreen

Pi 0.84.1's native `fullscreen` TUI owns transcript scrolling and the fixed bottom dock. `@herbertgao/pi-cc-extensions` integrates its mouse interactions with that native viewport. The old Fixed Editor compositor is retained only as a separately installable legacy package for Pi versions before 0.84.

## Maintenance

See [`docs/maintenance.md`](docs/maintenance.md) for per-package upstream baselines, synchronization, and npm OIDC bootstrap. A daily `Upstream Monitor` workflow checks npm releases and source-repository commits, then maintains one rolling reminder Issue.

## Attribution

The Tifan-derived packages and tintinweb-derived subagents package retain their original MIT notices and upstream links. HerbertGao's changes are maintained in this independent repository.
