import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { basename, isAbsolute, join, relative, sep } from "node:path"
import { Type } from "@earendil-works/pi-ai"
import {
  defineTool,
  parseFrontmatter,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent"

export const CATALOG_ROOT = join(homedir(), ".agency-agents")

// Top-level catalog directories that hold no source personas.
const NON_PERSONA_DIRS = new Set([
  "examples",
  "integrations",
  "scripts",
  "strategy",
])

export type Card = { path: string; name: string; description: string }
export type ScoredCard = Card & { score: number }

function realRoot(root: string): string {
  try {
    return realpathSync(root)
  } catch {
    throw new Error(
      `Agency Agents catalog not found at ${root}; clone https://github.com/msitarzewski/agency-agents there`,
    )
  }
}

/** Every `<division>/**\/*.md` with `name` and `description` frontmatter, sorted by path. */
export function loadCatalog(root: string): Card[] {
  const base = realRoot(root)
  const cards: Card[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.name.startsWith(".")) continue
      if (entry.isDirectory()) {
        if (dir !== base || !NON_PERSONA_DIRS.has(entry.name)) walk(path)
      } else if (dir !== base && entry.isFile() && path.endsWith(".md")) {
        try {
          const { name, description } = parseFrontmatter(
            readFileSync(path, "utf8"),
          ).frontmatter
          if (typeof name === "string" && typeof description === "string") {
            const relativePath = relative(base, path).split(sep).join("/")
            cards.push({ path: relativePath, name, description })
          }
        } catch {
          // Malformed YAML frontmatter: not a usable persona.
        }
      }
    }
  }
  walk(base)
  return cards.toSorted((a, b) => a.path.localeCompare(b.path))
}

const STOP_WORDS = new Set(
  "a an and are as at be by for from in is it of on or that the this to with".split(
    " ",
  ),
)

export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token && !STOP_WORDS.has(token))
    .map((token) =>
      token.length > 3 && token.endsWith("s") && !token.endsWith("ss")
        ? token.slice(0, -1)
        : token,
    )
}

/** Okapi BM25 over name, path and description, keeping at most `perDivision` cards per division. */
export function searchCatalog(
  cards: Card[],
  query: string,
  limit = 6,
  perDivision = 2,
): ScoredCard[] {
  const terms = [...new Set(tokenize(query))]
  const docs = cards.map((card) =>
    tokenize(`${card.name} ${card.path} ${card.description}`),
  )
  const avgLength =
    docs.reduce((sum, doc) => sum + doc.length, 0) / (docs.length || 1)
  const idf = terms.map((term) => {
    const df = docs.filter((doc) => doc.includes(term)).length
    return Math.log(1 + (docs.length - df + 0.5) / (df + 0.5))
  })
  const taken = new Map<string, number>()
  return cards
    .map((card, i) => {
      const doc = docs[i]
      let score = 0
      terms.forEach((term, t) => {
        const tf = doc.filter((token) => token === term).length
        if (tf)
          score +=
            (idf[t] * tf * 2.2) /
            (tf + 1.2 * (0.25 + (0.75 * doc.length) / avgLength))
      })
      return { ...card, score: Math.round(score * 100) / 100 }
    })
    .filter((card) => card.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .filter((card) => {
      const division = card.path.split("/")[0]
      const count = (taken.get(division) ?? 0) + 1
      taken.set(division, count)
      return count <= perDivision
    })
    .slice(0, limit)
}

/** A catalog persona's body without frontmatter. */
export function loadPersona(root: string, persona: string): string {
  const base = realRoot(root)
  const file = realpathSync(isAbsolute(persona) ? persona : join(base, persona))
  if (!file.startsWith(base + sep) || !file.endsWith(".md")) {
    throw new Error(`${persona} is not a persona file inside ${root}`)
  }
  const { frontmatter, body } = parseFrontmatter(readFileSync(file, "utf8"))
  if (typeof frontmatter.name !== "string") {
    throw new Error(`${persona} has no persona frontmatter`)
  }
  if (/<\/?persona>/i.test(body)) {
    throw new Error(`${persona} contains a reserved <persona> delimiter`)
  }
  return body
}

/** Fills `{{persona}}` and `{{shared}}` in one pass, so inserted text is never rescanned or `$`-expanded. */
export function fillPrompt(
  template: string,
  values: { persona?: string; shared?: string },
): string {
  for (const key of ["persona", "shared"] as const) {
    const count = template.split(`{{${key}}}`).length - 1
    if (values[key] === undefined && count > 0) {
      throw new Error(`prompt contains {{${key}}} but no ${key} was given`)
    }
    if (values[key] !== undefined && count !== 1) {
      throw new Error(`prompt must contain {{${key}}} exactly once`)
    }
  }
  return template.replace(
    /\{\{(persona|shared)\}\}/g,
    (_match, key: "persona" | "shared") => values[key] ?? "",
  )
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex")

/** Same wording pi-subagents prints, so one run reads the same on every surface. */
function statsLine(run: {
  durationMs: number | null
  toolUses: number | null
  tokens: string | null
}): string {
  const parts = [
    run.durationMs === null
      ? undefined
      : `${(run.durationMs / 1000).toFixed(1)}s`,
    run.toolUses === null
      ? undefined
      : `${run.toolUses} tool use${run.toolUses === 1 ? "" : "s"}`,
    run.tokens,
  ].filter(Boolean)
  return parts.length ? ` (${parts.join(", ")})` : ""
}
const NullableString = Type.Union([Type.String(), Type.Null()])
const NullableNumber = Type.Union([Type.Number(), Type.Null()])

/** Some models fill every optional parameter with "" or 0; every such value here means omitted. */
export function dropPlaceholders(args: unknown): any {
  return JSON.parse(
    JSON.stringify(args ?? {}),
    function (this: unknown, _key: string, value: unknown) {
      return !Array.isArray(this) && (value === "" || value === 0)
        ? undefined
        : value
    },
  )
}

export function agencyTools(root = CATALOG_ROOT) {
  const search = defineTool({
    name: "agency_search",
    label: "Agency Search",
    description:
      "Search the local Agency Agents catalog (~/.agency-agents) without listing or reading it into context. Each query (one per review axis or touchpoint) returns up to `limit` cards (catalog path, name, description) ranked by BM25 over name, path and description, with at most `per_division` cards per top-level division. Pick personas from the cards and let the seat read the file.",
    promptSnippet: "Shortlist Agency Agents personas by query",
    prepareArguments: dropPlaceholders,
    parameters: Type.Object({
      queries: Type.Array(Type.String(), {
        minItems: 1,
        description: "One query per axis or touchpoint.",
      }),
      limit: Type.Optional(
        Type.Integer({
          minimum: 1,
          description: "Cards per query. Default 6.",
        }),
      ),
      per_division: Type.Optional(
        Type.Integer({
          minimum: 1,
          description: "Cards per division and query. Default 2.",
        }),
      ),
    }),
    outputSchema: Type.Object({
      catalog: Type.String(),
      personas: Type.Integer(),
      results: Type.Array(
        Type.Object({
          query: Type.String(),
          cards: Type.Array(
            Type.Object({
              path: Type.String(),
              name: Type.String(),
              description: Type.String(),
              score: Type.Number(),
            }),
          ),
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const base = realRoot(root)
      const cards = loadCatalog(root)
      const results = params.queries.map((query) => ({
        query,
        cards: searchCatalog(cards, query, params.limit, params.per_division),
      }))
      const text = results
        .map(
          (result) =>
            `## ${result.query}\n` +
            (result.cards
              .map(
                (card) =>
                  `- ${join(base, card.path)} — ${card.name}: ${card.description}`,
              )
              .join("\n") || "(no match)"),
        )
        .join("\n\n")
      return {
        content: [
          {
            type: "text",
            text: `${cards.length} personas in ${root}\n\n${text}`,
          },
        ],
        details: {},
        structuredContent: { catalog: root, personas: cards.length, results },
      }
    },
  })

  const dispatch = defineTool({
    name: "agency_dispatch",
    label: "Agency Dispatch",
    description:
      "Run subagents in parallel through pi-subagents' Agent tool and return all results together. Runs are foreground, so no completion notifications follow. Each run's prompt is sent as written after `{{persona}}` is replaced by the persona file's body (frontmatter removed) and `{{shared}}` by `shared` or the text of `shared_file`, so persona text never passes through your context. Personas outside the catalog or containing <persona> delimiters are rejected. Every run shares one tool result, so its Agent calls stay nested and get no separate transcript rows: seat, review, and any other lane that needs its own row, model, or turn cap belongs in one Agent call per lane, not here. Each result carries status, the SHA-256 of the prompt actually sent, duration, tool uses, tokens, and output; `record_dir` also saves <id>.prompt.txt and <id>.return.txt and never overwrites. `max_turns` is omitted unless you set it, so a run decides when it is done. Defaults: subagent_type general-purpose, isolated true (built-in tools only).",
    promptSnippet:
      "Dispatch catalog personas to parallel subagents without reading them",
    prepareArguments: dropPlaceholders,
    promptGuidelines: [
      "For Agency Agents personas, use agency_search to pick the seat, then one Agent call per seat carrying that persona's path; reach for agency_dispatch only for bulk work that does not need a run per row.",
    ],
    parameters: Type.Object({
      runs: Type.Array(
        Type.Object({
          prompt: Type.String({
            description:
              "Sent as written. Contains {{persona}} exactly once when persona is set, and {{shared}} exactly once when shared or shared_file is set.",
          }),
          persona: Type.Optional(
            Type.String({
              description:
                "Persona file relative to the catalog, e.g. security/security-architect.md, or an absolute path inside it.",
            }),
          ),
          id: Type.Optional(
            Type.String({
              description:
                "Record file stem: letters, digits, dot, dash or underscore. Default: 1-based run index.",
            }),
          ),
          description: Type.Optional(
            Type.String({ description: "3-5 word label shown in the UI." }),
          ),
        }),
        { minItems: 1 },
      ),
      shared: Type.Optional(
        Type.String({ description: "Text for {{shared}} in every prompt." }),
      ),
      shared_file: Type.Optional(
        Type.String({ description: "File whose text fills {{shared}}." }),
      ),
      subagent_type: Type.Optional(Type.String()),
      isolated: Type.Optional(Type.Boolean()),
      model: Type.Optional(Type.String()),
      thinking: Type.Optional(Type.String()),
      max_turns: Type.Optional(
        Type.Integer({
          minimum: 1,
          description:
            "Turn cap. Omit it unless host policy requires one, so the run decides when it is done.",
        }),
      ),
      record_dir: Type.Optional(
        Type.String({
          description:
            "Absolute directory for <id>.prompt.txt and <id>.return.txt (mode 0600).",
        }),
      ),
    }),
    outputSchema: Type.Object({
      results: Type.Array(
        Type.Object({
          id: Type.String(),
          persona: NullableString,
          promptSha256: Type.String(),
          status: Type.String(),
          agentId: NullableString,
          model: NullableString,
          durationMs: NullableNumber,
          toolUses: NullableNumber,
          tokens: NullableString,
          output: Type.String(),
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx?.tools?.some((tool) => tool.name === "Agent")) {
        throw new Error(
          "agency_dispatch needs the Agent tool from pi-subagents",
        )
      }
      if (params.shared !== undefined && params.shared_file !== undefined) {
        throw new Error("Give shared or shared_file, not both")
      }
      const shared =
        params.shared_file === undefined
          ? params.shared
          : readFileSync(params.shared_file, "utf8")
      const runs = params.runs.map((run, index) => {
        const id = run.id ?? String(index + 1)
        if (!/^[\w.-]+$/.test(id)) throw new Error(`Invalid run id: ${id}`)
        const prompt = fillPrompt(run.prompt, {
          persona:
            run.persona === undefined
              ? undefined
              : loadPersona(root, run.persona),
          shared,
        })
        return { ...run, id, prompt }
      })
      if (new Set(runs.map((run) => run.id)).size !== runs.length) {
        throw new Error("Run ids must be unique")
      }

      const recordDir = params.record_dir
      const record = (name: string, text: string) =>
        recordDir &&
        writeFileSync(join(recordDir, name), text, { flag: "wx", mode: 0o600 })
      if (recordDir !== undefined) {
        if (!isAbsolute(recordDir)) {
          throw new Error("record_dir must be an absolute path")
        }
        mkdirSync(recordDir, { recursive: true, mode: 0o700 })
        const existing = runs
          .flatMap((run) => [`${run.id}.prompt.txt`, `${run.id}.return.txt`])
          .map((name) => join(recordDir, name))
          .find((path) => existsSync(path))
        if (existing) throw new Error(`${existing} already exists`)
        for (const run of runs) record(`${run.id}.prompt.txt`, run.prompt)
      }

      const options = Object.fromEntries(
        Object.entries({
          model: params.model,
          thinking: params.thinking,
          max_turns: params.max_turns,
        }).filter(([, value]) => value !== undefined),
      )
      const outcomes = await Promise.all(
        runs.map((run) =>
          ctx.executeTool("Agent", {
            subagent_type: params.subagent_type ?? "general-purpose",
            description:
              run.description ??
              (run.persona ? basename(run.persona, ".md") : `agency ${run.id}`),
            prompt: run.prompt,
            run_in_background: false,
            isolated: params.isolated ?? true,
            ...options,
          }),
        ),
      )

      const results = outcomes.map(({ result, isError }, i) => {
        const run = runs[i]
        const text = result.content
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("")
        const details = (result.details ?? {}) as {
          status?: string
          agentId?: string
          modelName?: string
          durationMs?: number
          toolUses?: number
          tokens?: string
        }
        // pi-subagents prefixes foreground output with "Agent completed in 5.4s (2 tool uses).\n\n".
        const header = /^(?:[\s\S]*?\n)?Agent completed in [^\n]*\n\n/.exec(
          text,
        )
        const output = header ? text.slice(header[0].length) : text
        // Reuse the producer's own wording so one run reads the same everywhere.

        record(`${run.id}.return.txt`, output)
        return {
          id: run.id,
          persona: run.persona ?? null,
          promptSha256: sha256(run.prompt),
          status: isError
            ? "error"
            : (details.status ?? (header ? "completed" : "unknown")),
          agentId: details.agentId ?? null,
          model: details.modelName ?? null,
          // A hand-off to the background reports zeroes where a run measured.
          durationMs:
            details.status === "background"
              ? null
              : (details.durationMs ?? null),
          toolUses:
            details.status === "background" ? null : (details.toolUses ?? null),
          tokens:
            details.status === "background" ? null : details.tokens || null,
          output,
        }
      })
      const text = results
        .map(
          (run) =>
            `## ${run.id}${run.persona ? ` ${run.persona}` : ""}: ${run.status}${statsLine(run)}\nsha256 ${run.promptSha256}\n\n${run.output}`,
        )
        .join("\n\n")
      return {
        content: [{ type: "text", text }],
        details: {},
        structuredContent: { results },
      }
    },
  })

  return { search, dispatch }
}

export default function piAgency(pi: ExtensionAPI): void {
  const { search, dispatch } = agencyTools()
  pi.registerTool(search)
  pi.registerTool(dispatch)
}
