# Retired: Reviewed Upstream Upgrade

GitHub Actions does not run files in this directory. Only `*.yml` and `*.yaml` files directly under `.github/workflows/` are workflows.

These files are the former in-repo agentic upgrade workflows, kept so the source stays readable:

- `upstream-upgrade.md` and `upstream-upgrade.lock.yml` — Copilot engine (`Reviewed Upstream Upgrade`, model `claude-sonnet-5.5`, fallback `gpt-6-luna`)
- `upstream-upgrade-agy.md` and `upstream-upgrade-agy.lock.yml` — earlier Agy engine copy (Antigravity CLI v1.3.6, model `gemini-3.8-flash-medium`)

They are retired. Do not move them back into `.github/workflows/`, recompile them into that directory, or dispatch them from `upstream-monitor.yml`. Schedule, `workflow_dispatch`, and `gh workflow run` cannot start them from here.

`Upstream Monitor` still creates and updates the tracking Issue. Cursor cloud agents and the Grok Bot routine turn those Issues into pull requests. That path lives outside this repository's Actions workflows.

Engine history, now inactive: Gemini (#257 / #263 / #264, HTTP 402), Copilot `gpt-6.1-sol` (#265), Agy (#270 / #310), Copilot again after #311, then Copilot `claude-sonnet-5.5` in #314. `COPILOT_GITHUB_TOKEN`, `GH_AW_CI_TRIGGER_TOKEN`, and `GEMINI_API_KEY` are not required to run Upstream Monitor.
