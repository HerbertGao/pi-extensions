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

| Package                                                                         | Pinned version | Purpose                                       |
| ------------------------------------------------------------------------------- | -------------- | --------------------------------------------- |
| [`@dietrichgebert/ponytail`](https://github.com/DietrichGebert/ponytail)        | `4.9.0`        | Minimal coding mode and maintenance skills.   |
| [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono) | `2.6.4`        | Structured user questionnaires.               |
| [`@narumitw/pi-btw`](https://github.com/narumiruna/pi-extensions)               | `0.55.0`       | Parallel side questions outside main history. |
| [`@pi-plugins/fast-mode`](https://github.com/k3dom/pi-plugins)                  | `0.1.9`        | Priority service tier for selected models.    |
| [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter)                | `2.27.0`       | MCP tools and skills.                         |
| [`pi-footer`](https://github.com/wobondar/pi-footer)                            | `0.5.1`        | Configurable multi-line footer/statusline.    |
| [`pi-lens`](https://github.com/apmantza/pi-lens)                                | `4.1.0`        | Code diagnostics and skills.                  |
| [`pi-web-access`](https://github.com/nicobailon/pi-web-access)                  | `0.24.1`       | Web search and content access.                |
| [`remote-pi`](https://github.com/jacobaraujo7/remote_pi)                        | `0.7.0`        | Private relay remote control and agent mesh.  |
| [`@czottmann/pi-automode`](https://github.com/czottmann/pi-automode)            | `1.11.0`       | Auto-mode guardrails.                         |

### Remote Pi trust boundary

This aggregate enables Remote Pi's extension and agent-network skill and carries its supervisor CLI/service templates, but it does not bundle the relay, mobile app, or Cockpit and does not install or activate the supervisor service automatically. Set `REMOTE_PI_RELAY` to a self-hosted relay restricted by Tailscale or another private network before first use. The relay can read routed content even over TLS/Tailscale; Remote Pi 0.7.0 is not end-to-end encrypted.

Accepted 0.7.0 limitations are documented in the aggregate package README: short-lived pairing material is persisted in Pi session data and can enter model context, same-user local IPC is unauthenticated, and cancelled first-time setup may hold its cwd lock until Pi exits.

## Recommended footer

The aggregate enables `pi-footer` and ships [`packages/pi-extensions/examples/pi-footer.json`](packages/pi-extensions/examples/pi-footer.json), a compact recommended layout for the bundled extensions. It keeps Pi's path, Git, token/context, model, and thinking information, uses a gray `•` separator, and gives MCP, Auto mode, LSP, Ponytail, Remote Pi, and Subagents dedicated rows. Copy it to `~/.pi/agent/extensions/pi-footer.json`; the package never overwrites existing user configuration.

## Native fullscreen

Pi 0.84.1's native `fullscreen` TUI owns transcript scrolling and the fixed bottom dock. `@herbertgao/pi-cc-extensions` integrates its mouse interactions with that native viewport. The old Fixed Editor compositor is retained only as a separately installable legacy package for Pi versions before 0.84.

## Maintenance

See [`docs/maintenance.md`](docs/maintenance.md) for per-package upstream baselines, synchronization, and npm OIDC bootstrap. A daily `Upstream Monitor` workflow checks npm releases and source-repository commits, then maintains one rolling reminder Issue.

## Attribution

The Tifan-derived packages and tintinweb-derived subagents package retain their original MIT notices and upstream links. HerbertGao's changes are maintained in this independent repository.
