import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import { readFileSync } from "node:fs"
import { homedir, hostname } from "node:os"
import { join } from "node:path"

const ASK_USER_PROMPT_EVENT = "rpiv:ask-user:prompt"
/** Give closed/unsupported UI calls time to finish before notifying. */
const NEEDS_INPUT_DELAY_MS = 400
// ponytail: fallback events lack dialog IDs; this window can merge distinct fallback prompts.
// Replace it with dialog IDs if the event source provides them.
const NEEDS_INPUT_DEDUP_MS = 1_500
const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_MAX_TITLE_LENGTH = 40
const DEFAULT_MIN_DURATION_MS = 0

export type BarkLocale = "en" | "zh-CN" | "zh-TW"
type NotificationEvent = "agentSettled" | "needsInput"
export type BarkTitleSource = "fixed" | "session"

const COPY: Record<
  BarkLocale,
  {
    agentSettled: string
    settledWithDuration: (duration: string) => string
    needsInput: string
    needsInputBody: string
  }
> = {
  en: {
    agentSettled: "✅ Pi finished",
    settledWithDuration: (duration) => `✅ Pi finished · ${duration}`,
    needsInput: "🟡 Pi needs your input",
    needsInputBody: "🟡 Needs your reply",
  },
  "zh-CN": {
    agentSettled: "✅ Pi 跑完了",
    settledWithDuration: (duration) => `✅ 已完成 · 用时 ${duration}`,
    needsInput: "🟡 Pi 等你回答",
    needsInputBody: "🟡 需要你回复",
  },
  "zh-TW": {
    agentSettled: "✅ Pi 已完成",
    settledWithDuration: (duration) => `✅ 已完成 · 耗時 ${duration}`,
    needsInput: "🟡 Pi 等你回覆",
    needsInputBody: "🟡 需要你回覆",
  },
}

export interface BarkTitleOptions {
  /** "fixed" keeps the localized Pi copy as the title (default). "session" uses the session title. */
  source: BarkTitleSource
  /** Maximum title length before truncation. */
  maxLength: number
}

export interface BarkConfig {
  endpoint: string
  machine: string
  locale: BarkLocale
  events: {
    agentSettled: boolean
    /** Any blocking user-facing dialog: approval, select, input, custom, ask_user_question. */
    needsInput: boolean
  }
  params: Record<string, string | number | boolean>
  timeoutMs: number
  title: BarkTitleOptions
  /** Skip the settle notification when the run finished faster than this. 0 notifies always. */
  minDurationMs: number
}

export function getConfigPath(): string {
  return join(
    process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"),
    "bark.json",
  )
}

export function resolveLocale(input: unknown): BarkLocale {
  const requested =
    typeof input === "string" && input.toLowerCase() !== "auto"
      ? input
      : Intl.DateTimeFormat().resolvedOptions().locale
  const locale = requested.toLowerCase()
  if (locale.includes("hant") || /^zh-(tw|hk|mo)/.test(locale)) return "zh-TW"
  if (locale.startsWith("zh")) return "zh-CN"
  return "en"
}

export function notificationTitle(
  locale: BarkLocale,
  event: NotificationEvent,
): string {
  return COPY[locale][event]
}

/** Render a bounded, human-readable duration such as `45s`, `2m14s`, or `1h3m`. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes < 60) return seconds ? `${minutes}m${seconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h${remainder}m` : `${hours}h`
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return ""
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export function truncateTitle(text: string, maxLength: number): string {
  const characters = Array.from(normalizeText(text))
  if (!maxLength || characters.length <= maxLength) return characters.join("")
  return `${characters
    .slice(0, maxLength - 1)
    .join("")
    .trimEnd()}…`
}

/** Read the text of a message content value (string or content-part array). */
export function readMessageText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter(
      (part) =>
        part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => (part as { text: string }).text)
    .join(" ")
}

/**
 * Pi session name if the user set one, else the first user message — the same
 * label most hosts show for the session.
 */
export function resolveSessionTitle(
  ctx: Pick<ExtensionContext, "sessionManager"> | undefined,
  getSessionName?: () => string | undefined,
): string {
  try {
    const named = getSessionName?.()
    if (typeof named === "string" && named.trim()) return named.trim()
  } catch {
    // fall through
  }
  try {
    const manager = ctx?.sessionManager
    const named = manager?.getSessionName?.()
    if (typeof named === "string" && named.trim()) return named.trim()
  } catch {
    // fall through
  }
  try {
    const entries = ctx?.sessionManager?.getEntries?.() ?? []
    for (const entry of entries) {
      if (entry?.type !== "message" || entry.message?.role !== "user") continue
      const text = normalizeText(readMessageText(entry.message.content))
      if (text) return text
    }
  } catch {
    // fall through
  }
  return ""
}

export function normalizeConfig(input: unknown): BarkConfig | undefined {
  if (!input || typeof input !== "object") return undefined
  const source = input as Record<string, unknown>
  if (source.enabled === false || typeof source.endpoint !== "string")
    return undefined

  try {
    const protocol = new URL(source.endpoint).protocol
    if (protocol !== "http:" && protocol !== "https:") return undefined
  } catch {
    return undefined
  }

  const eventSource =
    source.events && typeof source.events === "object"
      ? (source.events as Record<string, unknown>)
      : {}
  const params =
    source.params && typeof source.params === "object"
      ? Object.fromEntries(
          Object.entries(source.params).filter((entry) =>
            ["string", "number", "boolean"].includes(typeof entry[1]),
          ),
        )
      : {}
  const timeoutMs =
    typeof source.timeoutMs === "number" &&
    Number.isFinite(source.timeoutMs) &&
    source.timeoutMs > 0
      ? source.timeoutMs
      : DEFAULT_TIMEOUT_MS
  const titleSource =
    source.title && typeof source.title === "object"
      ? (source.title as Record<string, unknown>)
      : {}

  return {
    endpoint: source.endpoint,
    machine:
      typeof source.machine === "string" && source.machine.trim()
        ? source.machine.trim()
        : hostname(),
    locale: resolveLocale(source.locale),
    events: {
      agentSettled: eventSource.agentSettled !== false,
      // `askUserQuestion` is the pre-0.2 name and is still honored.
      needsInput:
        (eventSource.needsInput ?? eventSource.askUserQuestion) !== false,
    },
    params,
    timeoutMs,
    title: {
      source: titleSource.source === "session" ? "session" : "fixed",
      maxLength:
        typeof titleSource.maxLength === "number" &&
        Number.isFinite(titleSource.maxLength) &&
        titleSource.maxLength >= 1
          ? Math.floor(titleSource.maxLength)
          : DEFAULT_MAX_TITLE_LENGTH,
    },
    minDurationMs:
      typeof source.minDurationMs === "number" &&
      Number.isFinite(source.minDurationMs) &&
      source.minDurationMs >= 0
        ? source.minDurationMs
        : DEFAULT_MIN_DURATION_MS,
  }
}

export function loadConfig(path = getConfigPath()): BarkConfig | undefined {
  try {
    return normalizeConfig(JSON.parse(readFileSync(path, "utf8")))
  } catch {
    return undefined
  }
}

export function formatBody(config: BarkConfig, cwd: string): string {
  return `💻 ${config.machine}\n📁 ${cwd}`
}

export async function sendBark(
  config: BarkConfig,
  title: string,
  body: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const form = new URLSearchParams()
  for (const [key, value] of Object.entries(config.params))
    form.set(key, String(value))
  form.set("title", title)
  form.set("body", body)

  const response = await fetcher(config.endpoint, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(config.timeoutMs),
  })
  if (!response.ok) throw new Error(`Bark returned HTTP ${response.status}`)
}

export default function piBark(pi: ExtensionAPI): void {
  let config: BarkConfig | undefined
  let cwd = process.cwd()
  let userFacingSession = false
  let cachedTitle = ""
  let runStartedAt: number | null = null
  let pendingNeedsInput: ReturnType<typeof setTimeout> | undefined
  let uiPromptActive = false
  let lastFallbackAt = 0
  let lastUIPromptEndAt = 0

  const refreshTitle = (ctx: ExtensionContext | undefined): string => {
    const resolved = resolveSessionTitle(ctx, () => pi.getSessionName?.())
    if (resolved) cachedTitle = resolved
    return cachedTitle
  }

  const titleFor = (
    ctx: ExtensionContext | undefined,
    event: NotificationEvent,
  ): string => {
    if (!config) return ""
    if (config.title.source === "fixed")
      return notificationTitle(config.locale, event)
    const session = ctx ? refreshTitle(ctx) : cachedTitle
    return truncateTitle(session || config.machine, config.title.maxLength)
  }

  const notify = async (title: string, body: string): Promise<void> => {
    if (!config || !userFacingSession) return
    try {
      await sendBark(config, title, body)
    } catch {
      // Notifications are best-effort and must never interrupt Pi.
    }
  }

  const cancelNeedsInput = () => {
    clearTimeout(pendingNeedsInput)
    pendingNeedsInput = undefined
  }

  const resetNeedsInput = () => {
    cancelNeedsInput()
    uiPromptActive = false
    lastFallbackAt = 0
    lastUIPromptEndAt = 0
  }

  const scheduleNeedsInput = (ctx: ExtensionContext | undefined) => {
    if (!config?.events.needsInput || !userFacingSession) return
    cancelNeedsInput()
    pendingNeedsInput = setTimeout(() => {
      pendingNeedsInput = undefined
      if (!config?.events.needsInput || !userFacingSession) return
      if (!ctx) lastFallbackAt = Date.now()
      const prefix =
        config.title.source === "session"
          ? `${COPY[config.locale].needsInputBody}\n`
          : ""
      void notify(
        titleFor(ctx, "needsInput"),
        `${prefix}${formatBody(config, cwd)}`,
      )
    }, NEEDS_INPUT_DELAY_MS)
  }

  const unsubscribeAskUser = pi.events.on(ASK_USER_PROMPT_EVENT, () => {
    const now = Date.now()
    if (
      uiPromptActive ||
      now - lastUIPromptEndAt < NEEDS_INPUT_DEDUP_MS ||
      now - lastFallbackAt < NEEDS_INPUT_DEDUP_MS
    )
      return
    scheduleNeedsInput(undefined)
  })

  // Native prompt lifecycle cancels notifications for UI calls that finish
  // without opening a dialog, or that the user answers before the grace period.
  pi.on("ui_prompt_start", (_event, ctx) => {
    cwd = ctx.cwd
    uiPromptActive = true
    cancelNeedsInput()
    if (Date.now() - lastFallbackAt >= NEEDS_INPUT_DEDUP_MS)
      scheduleNeedsInput(ctx)
  })

  pi.on("ui_prompt_end", () => {
    uiPromptActive = false
    lastFallbackAt = 0
    lastUIPromptEndAt = Date.now()
    cancelNeedsInput()
  })

  pi.on("session_start", (_event, ctx) => {
    resetNeedsInput()
    config = loadConfig()
    cwd = ctx.cwd
    userFacingSession = ctx.hasUI
    runStartedAt = null
    cachedTitle = ""
    refreshTitle(ctx)
  })

  // Pi persists the user entry at message_end, not on submit, so the title cache has to be
  // refreshed on message/turn events rather than only at agent_start.
  pi.on("session_info_changed", (_event, ctx) => {
    refreshTitle(ctx)
  })

  pi.on("message_end", (_event, ctx) => {
    refreshTitle(ctx)
  })

  pi.on("turn_end", (_event, ctx) => {
    refreshTitle(ctx)
  })

  pi.on("agent_start", (_event, ctx) => {
    if (runStartedAt === null) {
      resetNeedsInput()
      runStartedAt = Date.now()
    }
    refreshTitle(ctx)
  })

  pi.on("agent_settled", async (_event, ctx) => {
    cwd = ctx.cwd
    resetNeedsInput()
    const startedAt = runStartedAt
    runStartedAt = null
    if (!config?.events.agentSettled) return

    const elapsed = startedAt === null ? null : Date.now() - startedAt
    if (elapsed !== null && elapsed < config.minDurationMs) return

    const copy = COPY[config.locale]
    const prefix =
      config.title.source === "session"
        ? `${
            elapsed === null
              ? copy.agentSettled
              : copy.settledWithDuration(formatDuration(elapsed))
          }\n`
        : ""
    // Await the request so a settle that races process shutdown still delivers.
    await notify(
      titleFor(ctx, "agentSettled"),
      `${prefix}${formatBody(config, cwd)}`,
    )
  })

  pi.on("session_shutdown", () => {
    userFacingSession = false
    resetNeedsInput()
    unsubscribeAskUser()
  })
}
