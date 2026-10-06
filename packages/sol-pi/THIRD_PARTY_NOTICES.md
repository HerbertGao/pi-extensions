# Third-Party Notices

This independently maintained package imports the MIT-licensed SoL-Pi source from [NVlabs/SoL-Pi](https://github.com/NVlabs/SoL-Pi). Original NVIDIA copyright and MIT notices are preserved; `package.json` records the imported baseline in `x-upstream`. Its npm tarball contains only SoL-Pi source, documentation, assets, and project metadata, without vendored Pi or Star History source.

## Runtime peer dependencies

The following packages are supplied by the user's Pi installation and retain their own licenses:

| Package | Development-tested version | License | Source |
| --- | ---: | --- | --- |
| `@earendil-works/pi-agent-core` | 1.0.4 | MIT | <https://github.com/earendil-works/pi> |
| `@earendil-works/pi-ai` | 1.0.4 | MIT | <https://github.com/earendil-works/pi> |
| `@earendil-works/pi-coding-agent` | 1.0.4 | MIT | <https://github.com/earendil-works/pi> |
| `@earendil-works/pi-tui` | 1.0.4 | MIT | <https://github.com/earendil-works/pi> |
| `typebox` | 1.3.7 | MIT | <https://github.com/sinclairzx81/typebox> |

## Development-only dependencies

`@types/node` (MIT), TypeScript (Apache-2.0), and Vitest (MIT) are used to type-check and test the repository. They are not included in the SoL-Pi npm tarball. Exact versions and transitive dependency metadata are recorded in the monorepo root's `bun.lock`.

## Star history chart generation

The upstream documentation workflow (not enabled in this monorepo) checks out the MIT-licensed [Star History renderer](https://github.com/star-history/star-history/tree/c326eac651bc5afb4cd40d354223dd419e1e2ae6) to preserve its chart design. Its source and dependencies are installed only for chart generation and are not included in the SoL-Pi npm tarball. The generated chart branch includes the upstream MIT license as `LICENSE-star-history.txt`.
