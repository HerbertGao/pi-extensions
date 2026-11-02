# Graphify

Graphify builds a queryable code graph for a repository. This monorepo keeps it as a standalone [PyPI](https://pypi.org/project/graphifyy/) tool. The package name is `graphifyy`, the command is `graphify`, and the license is Apache-2.0. Upstream source is [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify).

The default path is the skill and CLI registered by Graphify's own installer:

```bash
graphify install --platform pi
```

## Why it stays out of the npm aggregate

`@herbertgao/pi-extensions` bundles Pi extensions that Pi loads from one npm package root. Graphify is a Python 3.10+ CLI with its own environment. `uv tool install` is the install path that puts `graphify` on `PATH`. An entry in `dependencies` or `bundledDependencies` would not install that CLI, and this repository does not vendor Graphify's skill, MCP server, or guard.

`pi install npm:@herbertgao/pi-extensions` leaves Graphify uninstalled. Nothing in the npm lifecycle runs the bootstrap script.

## Install

Install [uv](https://docs.astral.sh/uv/) and have it on `PATH`. uv supplies the Python version Graphify needs. From a checkout of this repository:

```bash
scripts/bootstrap-graphify.sh
```

The script reads [`pins/graphifyy`](../pins/graphifyy), installs that exact `graphifyy` release with `uv tool install`, and runs `graphify install --platform pi`. That registers the `/graphify` skill for the current user. At the pinned release, upstream writes it to `~/.pi/agent/skills/graphify/SKILL.md`. The script does not pass `--project`, so the skill files stay out of this repository.

Re-running the script installs the same pin again. `uv tool install` exits successfully when that requirement is already satisfied, and Graphify's installer overwrites the user skill in place. If `uv` is missing, or `graphify` is still missing after the install, the script exits with an error. When the new executable is not on `PATH`, run `uv tool update-shell` and open a new shell. The script also checks `uv tool dir --bin` once so the skill registration can finish in the same run.

## Pin

[`pins/graphifyy`](../pins/graphifyy) is the version this repository expects. The current pin is `graphifyy==0.9.100`, the stable PyPI release checked on 2026-11-02. Bump that file to adopt a newer stable release, then re-run the bootstrap on each machine. The script installs the pin as written.

A second `uv tool install` of the plain pin replaces the previous tool receipt. Re-running the default bootstrap therefore drops an `[mcp]` extra that was added by hand. Opt in again afterward if that extra should remain.

## Several machines

Copy the same checkout, or pull it, onto each machine. Install `uv` there and run `scripts/bootstrap-graphify.sh`. The pin, this document, and the script are the shared setup. Each machine gets the same `graphifyy` version and the official Pi skill registration.

## Optional: MCP

The bootstrap does not install Graphify's MCP extra. Pi 0.99+ provides MCP itself; configure servers in `~/.pi/agent/mcp.json`. To add Graphify's stdio extra, install the same pin with the extra:

```bash
uv tool install "graphifyy[mcp]==0.9.100"
```

Use the version from `pins/graphifyy`. The same command is commented in `scripts/bootstrap-graphify.sh`. `graphify install` registers the skill. It does not open an MCP connection. Upstream describes the extra and the difference between skill instructions and MCP tools in the [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) README and the [installation docs](https://docs.graphify.com/installation).

## Optional: guard

Graphify ships a native Pi guard. This repository does not reimplement it and the bootstrap does not install it. After `graphify` is on `PATH`, opt in with upstream's command:

```bash
graphify pi guard install
```

Remove it with `graphify pi guard uninstall`. The install command is commented in `scripts/bootstrap-graphify.sh`. Upstream registers the guard through Pi's own installer from the Graphify package. Re-run `graphify pi guard install` after the tool environment changes, because the registered path points at that environment. Restart Pi after installing or removing the guard.

## Upstream Monitor

`upstreams.json` registers `graphifyy` with `"watch": "pypi"`. The expected version is the requirement in [`pins/graphifyy`](../pins/graphifyy). Upstream Monitor fetches the latest PyPI release and, when it differs from that pin, adds it to the same `chore: upstream updates available` Issue used for npm companions. A PyPI query error fails the workflow and leaves the Issue unchanged unless another release was detected. GitHub commits for Graphify are not part of this watch. Adopting a release means editing the pin and re-running the bootstrap. The npm aggregate still does not vendor `graphifyy`.

## Attribution

Graphify is published by Graphify Labs as `graphifyy` under the Apache-2.0 license: <https://github.com/Graphify-Labs/graphify>. This repository documents how to install that tool. It does not redistribute Graphify source.
