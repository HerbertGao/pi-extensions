# @herbertgao/pi-agency

Search the [Agency Agents](https://github.com/msitarzewski/agency-agents) catalog and dispatch its personas to Pi subagents without reading the catalog or persona files into the main context.

```bash
pi install npm:@herbertgao/pi-agency
git clone https://github.com/msitarzewski/agency-agents ~/.agency-agents
```

The catalog location is fixed at `~/.agency-agents`. `agency_dispatch` also needs the `Agent` tool from [`@herbertgao/pi-subagents`](../pi-subagents), which the `@herbertgao/pi-extensions` aggregate bundles. Requires Pi 0.99.0 or later.

## Tools

`agency_search({ queries, limit?, per_division? })` returns cards (`path`, `name`, `description`, `score`) for each query. The text form prints each card's absolute path; `catalog` plus `path` compose the same path for programmatic callers. It ranks every `<division>/**/*.md` file with `name` and `description` frontmatter by BM25 over name, path, and description. It returns at most `limit` cards per query (default 6) and `per_division` cards per top-level division (default 2). The repository's `integrations`, `strategy`, `examples`, and `scripts` directories are skipped.

`agency_dispatch({ runs, shared?, shared_file?, subagent_type?, isolated?, model?, thinking?, max_turns?, record_dir? })` runs every `runs[i].prompt` as a foreground `Agent` call, all in parallel, and returns when they finish. Foreground calls do not queue completion notifications for the parent session.

- `{{persona}}` is replaced by the body of `runs[i].persona` with its frontmatter removed. The file must resolve inside the catalog, symlinks included, and must not contain `<persona>` or `</persona>`.
- `{{shared}}` is replaced by `shared` or the text of `shared_file`.
- Each placeholder must appear exactly once when its value is given and must not appear otherwise. Substitution happens in one pass, so `$&` and placeholder-like text in inserted content stay literal.
- Defaults are `subagent_type: "general-purpose"` and `isolated: true`, which gives subagents built-in tools only.
- Each result includes `promptSha256` for the prompt actually sent, plus the run's status, agent id, resolved model, duration, tool uses, tokens, and output. The text form repeats those statistics on the heading of a completed run.
- All runs come back inside one tool result, so their `Agent` calls stay nested and get no separate transcript rows. Seat, review, and any other lane that needs its own row, its own model, or its own turn cap belongs in one `Agent` call per lane, not here.
- `max_turns` is omitted unless you pass it, so a run decides when it is done; set it only to bound a runaway.
- `record_dir` must be absolute and used by one dispatch at a time. It receives `<id>.prompt.txt` and `<id>.return.txt` with mode `0600`. The call fails before any dispatch if one of those files already exists.

Both tools return `structuredContent`, so codemode scripts receive objects instead of text.

```js
const { results } = await tools.agency_search({
  queries: ["OAuth login flows", "database migration safety"],
})
const { results: reviews } = await tools.agency_dispatch({
  shared_file: "/tmp/review/diff.patch",
  runs: results.map(({ cards: [card] }, i) => ({
    id: `expert-${i + 1}`,
    persona: card.path,
    prompt:
      "<persona>\n{{persona}}\n</persona>\n\nReview this diff:\n{{shared}}",
  })),
})
```
