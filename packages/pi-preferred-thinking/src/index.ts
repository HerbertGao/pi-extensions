import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent"

type ThinkingLevel = Parameters<ExtensionAPI["setThinkingLevel"]>[0]
type PiSettings = Record<string, unknown> & {
  enabledModels?: unknown
}

const SETTINGS_PATH = path.join(getAgentDir(), "settings.json")
const UNSET_OPTION = "unset"
const THINKING_LEVEL_OPTIONS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]
const HINT_WIDGET_KEY = "pi-preferred-thinking"
const HINT_DURATION_MS = 3_000

let hintTimer: ReturnType<typeof setTimeout> | undefined
const nudgedModels = new Set<string>()

function getModelKey(provider: string, modelId: string): string {
  return `${provider}/${modelId}`
}

function readSettings(): PiSettings {
  const content = readFileSync(SETTINGS_PATH, "utf8")
  let settings: unknown
  try {
    settings = JSON.parse(content)
  } catch {
    return {}
  }
  return settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as PiSettings)
    : {}
}

function getEnabledModels(settings: PiSettings): string[] {
  return Array.isArray(settings.enabledModels)
    ? settings.enabledModels.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : []
}

function isExactModelEntry(entry: string, modelKey: string): boolean {
  return (
    entry === modelKey ||
    THINKING_LEVEL_OPTIONS.some((level) => entry === `${modelKey}:${level}`)
  )
}

function saveThinkingLevel(
  modelKey: string,
  level: ThinkingLevel | undefined,
): void {
  const settings = readSettings()
  if (!Array.isArray(settings.enabledModels)) {
    throw new Error(
      "Pi enabledModels is not configured. Add the model with /scoped-models first.",
    )
  }

  const entries = getEnabledModels(settings)
  const exactIndex = entries.findIndex((entry) =>
    isExactModelEntry(entry, modelKey),
  )
  const nextEntries = entries.filter(
    (entry) => !isExactModelEntry(entry, modelKey),
  )
  const replacement = level
    ? `${modelKey}:${level}`
    : exactIndex >= 0
      ? modelKey
      : undefined

  if (replacement) {
    const insertAt =
      exactIndex < 0 ? 0 : Math.min(exactIndex, nextEntries.length)
    nextEntries.splice(insertAt, 0, replacement)
  }

  settings.enabledModels = nextEntries
  mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8")
}

function getPinnedThinkingLevel(
  ctx: ExtensionContext,
  modelKey: string,
): ThinkingLevel | undefined {
  const scopedModel = ctx.scopedModels.find(
    (entry) => getModelKey(entry.model.provider, entry.model.id) === modelKey,
  )
  if (scopedModel?.thinkingLevel !== undefined) {
    return scopedModel.thinkingLevel
  }

  try {
    const entry = getEnabledModels(readSettings()).find((candidate) =>
      candidate.startsWith(`${modelKey}:`),
    )
    const level = entry?.slice(modelKey.length + 1) as ThinkingLevel | undefined
    return level && THINKING_LEVEL_OPTIONS.includes(level) ? level : undefined
  } catch {
    return undefined
  }
}

function clearHint(ctx: ExtensionContext): void {
  if (hintTimer) {
    clearTimeout(hintTimer)
    hintTimer = undefined
  }
  ctx.ui.setWidget(HINT_WIDGET_KEY, undefined)
}

function showHint(ctx: ExtensionContext, modelKey: string): void {
  if (!ctx.hasUI) return
  clearHint(ctx)
  ctx.ui.setWidget(
    HINT_WIDGET_KEY,
    [
      `No saved thinking level for ${modelKey}.`,
      "Run /preferred-thinking to set one.",
    ],
    { placement: "aboveEditor" },
  )
  hintTimer = setTimeout(() => {
    ctx.ui.setWidget(HINT_WIDGET_KEY, undefined)
    hintTimer = undefined
  }, HINT_DURATION_MS)
}

function applyPreferredThinking(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  model: NonNullable<ExtensionContext["model"]>,
): void {
  const modelKey = getModelKey(model.provider, model.id)
  const thinkingLevel = getPinnedThinkingLevel(ctx, modelKey)

  if (thinkingLevel !== undefined) {
    clearHint(ctx)
    if (pi.getThinkingLevel() !== thinkingLevel) {
      pi.setThinkingLevel(thinkingLevel)
    }
    return
  }

  if (model.reasoning && !nudgedModels.has(modelKey)) {
    nudgedModels.add(modelKey)
    showHint(ctx, modelKey)
  }
}

async function configurePreferredThinking(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const model = ctx.model
  if (!model) {
    ctx.ui.notify("No current model selected.", "error")
    return
  }

  const modelKey = getModelKey(model.provider, model.id)
  const current = getPinnedThinkingLevel(ctx, modelKey) ?? UNSET_OPTION
  const selected = await ctx.ui.select(
    `Preferred thinking for ${modelKey} (current: ${current})`,
    [...THINKING_LEVEL_OPTIONS, UNSET_OPTION],
  )
  if (selected === undefined) return

  const level = THINKING_LEVEL_OPTIONS.includes(selected as ThinkingLevel)
    ? (selected as ThinkingLevel)
    : undefined

  try {
    saveThinkingLevel(modelKey, level)
  } catch (error) {
    const reason = error instanceof SyntaxError ? "invalid JSON" : String(error)
    ctx.ui.notify(`Could not update Pi settings: ${reason}`, "error")
    return
  }

  if (level) {
    pi.setThinkingLevel(level)
    ctx.ui.notify(`Thinking for ${modelKey} set to ${level}.`, "info")
  } else {
    ctx.ui.notify(`Thinking pin for ${modelKey} removed.`, "info")
  }

  await ctx.reload()
}

export default function (pi: ExtensionAPI): void {
  pi.registerCommand("preferred-thinking", {
    description: "set the native thinking level for the current model",
    handler: async (_args, ctx) => {
      await configurePreferredThinking(pi, ctx)
    },
  })

  pi.on("session_start", async (_event, ctx) => {
    nudgedModels.clear()
    if (ctx.model) applyPreferredThinking(pi, ctx, ctx.model)
  })

  pi.on("model_select", async (event, ctx) => {
    applyPreferredThinking(pi, ctx, event.model)
  })

  pi.on("session_shutdown", async (_event, ctx) => {
    clearHint(ctx)
  })
}
