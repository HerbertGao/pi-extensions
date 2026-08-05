# @herbertgao/pi-extensions

A collection of HerbertGao-maintained and pinned upstream extensions for the [Pi coding agent](https://pi.dev).

## Install the collection

```bash
pi install npm:@herbertgao/pi-extensions
```

The aggregate package bundles every maintained package below plus the pinned upstream companions listed afterward, so Pi loads them from one isolated package root. Individual maintained packages can also be installed separately.

## Packages

| Package                                                               | Description                                                                 | Source                                                                                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [`@herbertgao/pi-copy-response`](packages/pi-copy-response)           | Pick and copy an assistant response.                                        | [`@tifan/pi-copy-response`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-copy-response)           |
| [`@herbertgao/pi-fixed-editor`](packages/pi-fixed-editor)             | Keep the editor and footer fixed with reduced streaming repaint.            | [`@tifan/pi-fixed-editor`](https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-fixed-editor)             |
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
| [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter)                | `2.19.0`       | MCP tools and skills.           |
| [`pi-lens`](https://github.com/apmantza/pi-lens)                                | `3.8.74`       | Code diagnostics and skills.    |
| [`pi-web-access`](https://github.com/nicobailon/pi-web-access)                  | `0.18.0`       | Web search and content access.  |
| [`@czottmann/pi-automode`](https://github.com/czottmann/pi-automode)            | `1.9.0`        | Auto-mode guardrails.           |

## Pi-cc status

`@herbertgao/pi-cc-extensions` is planned but not copied or published. Its upstream repository currently has no explicit license, so redistribution is blocked until the maintainer adds one or grants permission. Local Pi can continue using upstream `pi-cc-extensions` with a fixed-editor override in the meantime.

## Maintenance

See [`docs/maintenance.md`](docs/maintenance.md) for package policy, upstream baselines, synchronization, and npm OIDC bootstrap.

## Attribution

The Tifan-derived packages and tintinweb-derived subagents package retain their original MIT notices and upstream links. HerbertGao's changes are maintained in this independent repository.
