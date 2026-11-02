# @herbertgao/pi-extensions

A collection of HerbertGao-maintained and pinned upstream extensions for the [Pi coding agent](https://pi.dev).

## Install the collection

```bash
pi install npm:@herbertgao/pi-extensions
```

Requires Node.js 22.19.0 or newer and Pi 1.2.0 or newer.

The aggregate package bundles the active maintained packages below plus the pinned upstream companions listed afterward, so Pi loads them from one isolated package root. Individual maintained packages can also be installed separately.

## Native MCP

MCP is provided by Pi 0.99.0+, not by an extension in this collection. Configure servers in `~/.pi/agent/mcp.json` and manage them with `/mcp`. Older Pi versions need an upgrade to retain MCP support after this collection stops bundling `pi-mcp-adapter`.

## Native thinking levels

Per-model thinking levels are provided by Pi. This collection no longer bundles `@tifan/pi-preferred-thinking`.

## Maintained packages

| Package                                                     | Downloads                                                                            | Description                                                               | Source                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`@herbertgao/pi-agency`](packages/pi-agency)               | ![npm monthly downloads](https://img.shields.io/npm/dm/@herbertgao/pi-agency)        | Search and dispatch Agency Agents personas without loading them.          | This repository                                                        |
| [`@herbertgao/pi-bark`](packages/pi-bark)                   | ![npm monthly downloads](https://img.shields.io/npm/dm/@herbertgao/pi-bark)          | Bark notifications when Pi finishes or needs user input.                  | This repository                                                        |
| [`@herbertgao/pi-cc-extensions`](packages/pi-cc-extensions) | ![npm monthly downloads](https://img.shields.io/npm/dm/@herbertgao/pi-cc-extensions) | Claude Code-style output, fullscreen interaction, context and references. | [`pi-cc-extensions`](https://github.com/minuque/pi-cc-extensions)      |
| [`@herbertgao/pi-impeccable`](packages/pi-impeccable)       | ![npm monthly downloads](https://img.shields.io/npm/dm/@herbertgao/pi-impeccable)    | Impeccable design skills and deterministic anti-pattern detection.        | [`impeccable`](https://github.com/pbakaus/impeccable)                  |
| [`@herbertgao/sol-pi`](packages/sol-pi)                     | ![npm monthly downloads](https://img.shields.io/npm/dm/@herbertgao/sol-pi)           | Token-efficient tools, observations, logs, and context compaction.        | [`NVlabs/SoL-Pi`](https://github.com/NVlabs/SoL-Pi)                    |
| [`@herbertgao/pi-subagents`](packages/pi-subagents)         | ![npm monthly downloads](https://img.shields.io/npm/dm/@herbertgao/pi-subagents)     | Autonomous subagents with lifecycle and compatibility hardening.          | [`@tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents) |
| [`@herbertgao/pi-extensions`](packages/pi-extensions)       | ![npm monthly downloads](https://img.shields.io/npm/dm/@herbertgao/pi-extensions)    | Aggregate installer for the collection.                                   | This repository                                                        |

## Bundled upstream companions

These packages retain their original names and upstream maintainers. The aggregate package pins and bundles them; this repository does not fork or republish their source under `@herbertgao/*`.

| Package                                                                         | Pinned version | Purpose                                           |
| ------------------------------------------------------------------------------- | -------------- | ------------------------------------------------- |
| [`@dietrichgebert/ponytail`](https://github.com/DietrichGebert/ponytail)        | `5.3.3`        | Minimal coding mode and maintenance skills.       |
| [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono) | `2.15.0`       | Structured user questionnaires.                   |
| [`@narumitw/pi-btw`](https://github.com/narumiruna/pi-extensions)               | `0.63.3`       | Parallel side questions outside main history.     |
| [`@narumitw/pi-caffeinate`](https://github.com/narumiruna/pi-extensions)        | `0.49.13`      | Keep the computer awake during Pi agent runs.     |
| [`@pi-plugins/fast-mode`](https://github.com/k3dom/pi-plugins)                  | `0.1.14`       | Priority service tier for selected models.        |
| [`@tifan/pi-copy-response`](https://github.com/tifandotme/pi-extensions)        | `0.2.7`        | Pick and copy an assistant response.              |
| [`@tifan/pi-handoff`](https://github.com/tifandotme/pi-extensions)              | `2.2.2`        | Session handoffs and queries.                     |
| [`@tifan/pi-mermaid-open`](https://github.com/tifandotme/pi-extensions)         | `0.2.2`        | Extract and open Mermaid diagrams.                |
| [`@tifan/pi-recap`](https://github.com/tifandotme/pi-extensions)                | `0.4.8`        | Generate one-line session recaps.                 |
| [`@tifan/pi-rename`](https://github.com/tifandotme/pi-extensions)               | `0.6.0`        | Generate session names and rename Herdr.          |
| [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks)                  | `0.9.1`        | Task lists and subagent task execution.           |
| [`pi-antigravity`](https://www.npmjs.com/package/pi-antigravity)                | `0.11.0`       | Antigravity models, search, and image generation. |
| [`pi-commandcode-provider`](https://github.com/patlux/pi-commandcode-provider)  | `0.7.11`       | Command Code subscription models and `/login`.    |
| [`pi-next-cue`](https://www.npmjs.com/package/pi-next-cue)                      | `1.0.8`        | Predict the next prompt; Tab fills, Enter sends.  |
| [`pi-typesafe`](https://github.com/DevMortimer/pi-typesafe)                     | `0.13.1`       | Structured TypeSafe/Jev decisions.                |
| [`pi-lens`](https://github.com/apmantza/pi-lens)                                | `4.4.8`        | Code diagnostics and skills.                      |
| [`pi-web-access`](https://github.com/nicobailon/pi-web-access)                  | `0.46.0`       | Web search and content access.                    |
| [`pi-provider-qoder`](https://github.com/simonsmh/pi-provider-qoder)            | `0.6.8`        | Qoder account models for global and China.        |

## Companion tools

[Graphify](docs/graphify.md) is an optional standalone code-graph CLI (`graphifyy` on PyPI). It is not part of the npm aggregate.

## Local extension

The aggregate also includes [`clef`](packages/pi-extensions/extensions/clef.mjs), a local extension rather than a separate npm package. Its `clef` tool asks Cloudflare Clef-flash for yes/no, choice, or score judgments and displays the questions and answers in the transcript. It is not a permission gate.

## Footer

The configurable status bar is provided by `@herbertgao/pi-cc-extensions` (enabled by default, `/ccstyle` → Footer page). `pi-footer` is no longer bundled; if it was installed separately, remove it so only one footer extension owns the status bar.

## Native fullscreen

Pi 0.85.1's native `fullscreen` TUI owns transcript scrolling and the fixed bottom dock. `@herbertgao/pi-cc-extensions` integrates its mouse interactions with that native viewport.

## Maintenance

See [`docs/maintenance.md`](docs/maintenance.md) for per-package upstream baselines, synchronization, and npm OIDC bootstrap. A daily `Upstream Monitor` workflow checks npm releases and source-repository commits, then maintains one rolling reminder Issue. Cursor cloud agents and the Grok Bot routine turn those Issues into pull requests. This repository does not run a Reviewed Upstream Upgrade workflow.

## Attribution

The maintained pi-cc and tintinweb-derived subagents packages retain their original MIT notices and upstream links. Directly bundled companions retain their upstream package names; the aggregate ships their required notices in [`THIRD_PARTY_NOTICES.md`](packages/pi-extensions/THIRD_PARTY_NOTICES.md). HerbertGao's changes are maintained in this independent repository.
