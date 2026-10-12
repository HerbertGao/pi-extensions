# @herbertgao/pi-extensions

A collection of HerbertGao-maintained and pinned upstream extensions for the [Pi coding agent](https://pi.dev).

## Install the collection

```bash
pi install npm:@herbertgao/pi-extensions
```

Requires Node.js 24 or newer and Pi 1.0.4 or newer.

The aggregate package bundles the active maintained packages below plus the pinned upstream companions listed afterward, so Pi loads them from one isolated package root. Individual maintained packages can also be installed separately.

## Native MCP

MCP is provided by Pi 0.99.0+, not by an extension in this collection. Configure servers in `~/.pi/agent/mcp.json` and manage them with `/mcp`. Older Pi versions need an upgrade to retain MCP support after this collection stops bundling `pi-mcp-adapter`.

## Maintained packages

| Package                                                     | Description                                                               | Source                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`@herbertgao/pi-agency`](packages/pi-agency)               | Search and dispatch Agency Agents personas without loading them.          | This repository                                                        |
| [`@herbertgao/pi-bark`](packages/pi-bark)                   | Bark notifications when Pi finishes or needs user input.                  | This repository                                                        |
| [`@herbertgao/pi-cc-extensions`](packages/pi-cc-extensions) | Claude Code-style output, fullscreen interaction, context and references. | [`pi-cc-extensions`](https://github.com/minuque/pi-cc-extensions)      |
| [`@herbertgao/sol-pi`](packages/sol-pi)                     | Token-efficient tools, observations, logs, and context compaction.        | [`NVlabs/SoL-Pi`](https://github.com/NVlabs/SoL-Pi)                    |
| [`@herbertgao/pi-subagents`](packages/pi-subagents)         | Autonomous subagents with lifecycle and compatibility hardening.          | [`@tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents) |
| [`@herbertgao/pi-extensions`](packages/pi-extensions)       | Aggregate installer for the collection.                                   | This repository                                                        |

## Bundled upstream companions

These packages retain their original names and upstream maintainers. The aggregate package pins and bundles them; this repository does not fork or republish their source under `@herbertgao/*`.

| Package                                                                         | Pinned version | Purpose                                       |
| ------------------------------------------------------------------------------- | -------------- | --------------------------------------------- |
| [`@dietrichgebert/ponytail`](https://github.com/DietrichGebert/ponytail)        | `5.1.0`        | Minimal coding mode and maintenance skills.   |
| [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono) | `2.12.0`       | Structured user questionnaires.               |
| [`@narumitw/pi-btw`](https://github.com/narumiruna/pi-extensions)               | `0.61.1`       | Parallel side questions outside main history. |
| [`@narumitw/pi-caffeinate`](https://github.com/narumiruna/pi-extensions)        | `0.49.11`      | Keep the computer awake during Pi agent runs. |
| [`@pi-plugins/fast-mode`](https://github.com/k3dom/pi-plugins)                  | `0.1.13`       | Priority service tier for selected models.    |
| [`@tifan/pi-copy-response`](https://github.com/tifandotme/pi-extensions)        | `0.2.7`        | Pick and copy an assistant response.          |
| [`@tifan/pi-handoff`](https://github.com/tifandotme/pi-extensions)              | `2.2.2`        | Session handoffs and queries.                 |
| [`@tifan/pi-inline-skills`](https://github.com/tifandotme/pi-extensions)        | `1.0.6`        | Inline `/skill` autocomplete.                 |
| [`@tifan/pi-mermaid-open`](https://github.com/tifandotme/pi-extensions)         | `0.2.2`        | Extract and open Mermaid diagrams.            |
| [`@tifan/pi-preferred-thinking`](https://github.com/tifandotme/pi-extensions)   | `1.0.2`        | Persist thinking levels per model.            |
| [`@tifan/pi-recap`](https://github.com/tifandotme/pi-extensions)                | `0.4.8`        | Generate one-line session recaps.             |
| [`@tifan/pi-rename`](https://github.com/tifandotme/pi-extensions)               | `0.6.0`        | Generate session names and rename Herdr.      |
| [`pi-jev-auto-mode`](https://github.com/jomatsu/pi-jev-auto-mode)               | `0.5.0`        | Fail-closed Jev safety gates for tool calls.  |
| [`pi-typesafe`](https://github.com/DevMortimer/pi-typesafe)                     | `0.9.1`        | Structured TypeSafe/Jev decisions.            |
| [`pi-multi-account`](https://github.com/Sarrius/pi-multi-account)               | `1.24.0`       | Multi-account failover and rotation.          |
| [`pi-lens`](https://github.com/apmantza/pi-lens)                                | `4.4.1`        | Code diagnostics and skills.                  |
| [`pi-web-access`](https://github.com/nicobailon/pi-web-access)                  | `0.38.0`       | Web search and content access.                |
| [`pi-provider-qoder`](https://github.com/simonsmh/pi-provider-qoder)            | `0.5.0`        | Qoder account models for global and China.    |
| [`resume-from`](https://github.com/alexei-led/resume-from)                      | `0.4.1`        | Continue Pi, Claude Code, and Codex sessions. |

## Footer

The configurable status bar is provided by `@herbertgao/pi-cc-extensions` (enabled by default, `/ccstyle` → Footer page). `pi-footer` is no longer bundled; if it was installed separately, remove it so only one footer extension owns the status bar.

## Native fullscreen

Pi 0.85.1's native `fullscreen` TUI owns transcript scrolling and the fixed bottom dock. `@herbertgao/pi-cc-extensions` integrates its mouse interactions with that native viewport.

## Maintenance

See [`docs/maintenance.md`](docs/maintenance.md) for per-package upstream baselines, synchronization, and npm OIDC bootstrap. A daily `Upstream Monitor` workflow checks npm releases and source-repository commits, then maintains one rolling reminder Issue.

## Attribution

The maintained pi-cc and tintinweb-derived subagents packages retain their original MIT notices and upstream links. Directly bundled companions retain their upstream package names; the aggregate ships their required notices in [`THIRD_PARTY_NOTICES.md`](packages/pi-extensions/THIRD_PARTY_NOTICES.md). HerbertGao's changes are maintained in this independent repository.
