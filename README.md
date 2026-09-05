# @herbertgao/pi-extensions

A collection of HerbertGao-maintained and pinned upstream extensions for the [Pi coding agent](https://pi.dev).

## Install the collection

```bash
pi install npm:@herbertgao/pi-extensions
```

Requires Node.js 24 or newer and Pi 0.84.4 or newer.

The aggregate package bundles the active maintained packages below plus the pinned upstream companions listed afterward, so Pi loads them from one isolated package root. Individual maintained packages can also be installed separately.

## Maintained packages

| Package                                                     | Description                                                               | Source                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`@herbertgao/pi-bark`](packages/pi-bark)                   | Bark notifications when Pi finishes or needs user input.                  | This repository                                                        |
| [`@herbertgao/pi-cc-extensions`](packages/pi-cc-extensions) | Claude Code-style output, fullscreen interaction, context and references. | [`pi-cc-extensions`](https://github.com/minuque/pi-cc-extensions)      |
| [`@herbertgao/resume-from`](packages/resume-from)           | Continue sessions across Pi, Claude Code, and Codex.                      | [`resume-from`](https://github.com/alexei-led/resume-from)             |
| [`@herbertgao/pi-subagents`](packages/pi-subagents)         | Autonomous subagents with lifecycle and compatibility hardening.          | [`@tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents) |
| [`@herbertgao/pi-extensions`](packages/pi-extensions)       | Aggregate installer for the collection.                                   | This repository                                                        |

## Bundled upstream companions

These packages retain their original names and upstream maintainers. The aggregate package pins and bundles them; this repository does not fork or republish their source under `@herbertgao/*`.

| Package                                                                         | Pinned version | Purpose                                       |
| ------------------------------------------------------------------------------- | -------------- | --------------------------------------------- |
| [`@dietrichgebert/ponytail`](https://github.com/DietrichGebert/ponytail)        | `4.9.0`        | Minimal coding mode and maintenance skills.   |
| [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono) | `2.8.0`        | Structured user questionnaires.               |
| [`@luxusai/pi-hindsight`](https://github.com/luxus/pi-hindsight)                | `0.12.0`       | Hindsight-backed cross-host project memory.   |
| [`@narumitw/pi-btw`](https://github.com/narumiruna/pi-extensions)               | `0.56.0`       | Parallel side questions outside main history. |
| [`@narumitw/pi-caffeinate`](https://github.com/narumiruna/pi-extensions)        | `0.49.7`       | Keep the computer awake during Pi agent runs. |
| [`@pi-plugins/fast-mode`](https://github.com/k3dom/pi-plugins)                  | `0.1.10`       | Priority service tier for selected models.    |
| [`@tifan/pi-copy-response`](https://github.com/tifandotme/pi-extensions)        | `0.2.6`        | Pick and copy an assistant response.          |
| [`@tifan/pi-handoff`](https://github.com/tifandotme/pi-extensions)              | `2.2.0`        | Session handoffs and queries.                 |
| [`@tifan/pi-inline-skills`](https://github.com/tifandotme/pi-extensions)        | `1.0.5`        | Inline `/skill` autocomplete.                 |
| [`@tifan/pi-mermaid-open`](https://github.com/tifandotme/pi-extensions)         | `0.2.0`        | Extract and open Mermaid diagrams.            |
| [`@tifan/pi-preferred-thinking`](https://github.com/tifandotme/pi-extensions)   | `1.0.1`        | Persist thinking levels per model.            |
| [`@tifan/pi-recap`](https://github.com/tifandotme/pi-extensions)                | `0.4.6`        | Generate one-line session recaps.             |
| [`@tifan/pi-rename`](https://github.com/tifandotme/pi-extensions)               | `0.6.0`        | Generate session names and rename Herdr.      |
| [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter)                | `2.31.0`       | MCP tools and skills.                         |
| [`pi-footer`](https://github.com/wobondar/pi-footer)                            | `0.5.1`        | Configurable multi-line footer/statusline.    |
| [`pi-lens`](https://github.com/apmantza/pi-lens)                                | `4.1.3`        | Code diagnostics and skills.                  |
| [`pi-web-access`](https://github.com/nicobailon/pi-web-access)                  | `0.27.0`       | Web search and content access.                |
| [`remote-pi`](https://github.com/jacobaraujo7/remote_pi)                        | `0.7.0`        | Private relay remote control and agent mesh.  |
| [`@czottmann/pi-automode`](https://github.com/czottmann/pi-automode)            | `1.15.0`       | Auto-mode guardrails and diagnostics.         |

### Remote Pi trust boundary

This aggregate enables Remote Pi's extension and agent-network skill and carries its supervisor CLI/service templates, but it does not bundle the relay, mobile app, or Cockpit and does not install or activate the supervisor service automatically. Set `REMOTE_PI_RELAY` to a self-hosted relay restricted by Tailscale or another private network before first use. The relay can read routed content even over TLS/Tailscale; Remote Pi 0.7.0 is not end-to-end encrypted.

Accepted 0.7.0 limitations are documented in the aggregate package README: short-lived pairing material is persisted in Pi session data and can enter model context, same-user local IPC is unauthenticated, and cancelled first-time setup may hold its cwd lock until Pi exits.

## Recommended footer

The aggregate enables `pi-footer` and ships [`packages/pi-extensions/examples/pi-footer.json`](packages/pi-extensions/examples/pi-footer.json), a compact recommended layout for the bundled extensions. It keeps Pi's path, Git, token/context, model, and thinking information, uses a gray `•` separator, and gives MCP, Auto mode, LSP, Ponytail, Remote Pi, and Subagents dedicated rows. Copy it to `~/.pi/agent/extensions/pi-footer.json`; the package never overwrites existing user configuration.

## Native fullscreen

Pi 0.84.4's native `fullscreen` TUI owns transcript scrolling and the fixed bottom dock. `@herbertgao/pi-cc-extensions` integrates its mouse interactions with that native viewport.

## Maintenance

See [`docs/maintenance.md`](docs/maintenance.md) for per-package upstream baselines, synchronization, and npm OIDC bootstrap. A daily `Upstream Monitor` workflow checks npm releases and source-repository commits, then maintains one rolling reminder Issue.

## Attribution

The maintained pi-cc, tintinweb-derived subagents, and Alexei Led's `resume-from` packages retain their original MIT notices and upstream links. Directly bundled companions retain their upstream package names; the aggregate ships their required notices in [`THIRD_PARTY_NOTICES.md`](packages/pi-extensions/THIRD_PARTY_NOTICES.md). HerbertGao's changes are maintained in this independent repository.
