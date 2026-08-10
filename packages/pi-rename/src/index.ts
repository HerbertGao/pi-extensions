import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { AgentMessage } from "@earendil-works/pi-agent-core"
import type { AutocompleteItem } from "@earendil-works/pi-tui"
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import { buildSessionContext } from "@earendil-works/pi-coding-agent"
import { pickRenameModel } from "./model-picker.js"
import {
  deleteRenameConfig,
  formatAuthModelKey,
  formatModelPreference,
  formatRenameModelKey,
  getAuthenticatedTextModelPreferences,
  getRenameModelAuth,
  resolveInitialModelConfig,
  saveModelPreference,
  type RenameModelConfig,
} from "./models.js"
import { generateRename, getUserMessageContext } from "./naming.js"

const execFileAsync = promisify(execFile)
interface SessionContextReader {
  buildSessionContext(): { messages: AgentMessage[] }
}

interface RenameState {
  modelConfig: RenameModelConfig
}

const RENAME_SUBCOMMANDS: AutocompleteItem[] = [
  {
    value: "status",
    label: "status",
    description: "Show model and rename status",
  },
  {
    value: "config",
    label: "config",
    description: "Choose the rename model",
  },
  {
    value: "help",
    label: "help",
    description: "List rename commands",
  },
]

function createRenameState(): RenameState {
  return {
    modelConfig: { kind: "missing" },
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

interface HerdrTabInfo {
  readonly id: string
  readonly label?: string
  readonly number?: number
}

function parseRecord(value: string): Record<string, unknown> | undefined {
  try {
    return asRecord(JSON.parse(value) as unknown)
  } catch {
    return undefined
  }
}

function extractTabId(stdout: string): string | undefined {
  const parsed = parseRecord(stdout)
  const result = asRecord(parsed?.["result"])
  const pane = asRecord(result?.["pane"])
  const tabId = pane?.["tab_id"]
  return typeof tabId === "string" && tabId.trim() ? tabId : undefined
}

function extractTabInfo(stdout: string): HerdrTabInfo | undefined {
  const parsed = parseRecord(stdout)
  const result = asRecord(parsed?.["result"])
  const tab = asRecord(result?.["tab"])
  const tabId = tab?.["tab_id"]

  if (typeof tabId !== "string" || !tabId.trim()) return undefined

  const label = tab?.["label"]
  const number = tab?.["number"]

  return {
    id: tabId,
    ...(typeof label === "string" ? { label } : {}),
    ...(typeof number === "number" ? { number } : {}),
  }
}

async function getCurrentHerdrTabId(): Promise<string | undefined> {
  const paneId = process.env["HERDR_PANE_ID"]?.trim()
  if (!paneId) return undefined

  const { stdout } = await execFileAsync("herdr", ["pane", "get", paneId])
  return extractTabId(stdout)
}

async function getCurrentHerdrTabInfo(): Promise<HerdrTabInfo | undefined> {
  const tabId = await getCurrentHerdrTabId()
  if (!tabId) return undefined

  const { stdout } = await execFileAsync("herdr", ["tab", "get", tabId])
  return extractTabInfo(stdout)
}

function isDefaultHerdrTabLabel(tab: HerdrTabInfo): boolean {
  const label = tab.label?.trim()
  if (!label) return true

  return typeof tab.number === "number" && label === String(tab.number)
}

async function renameCurrentHerdrTab(name: string): Promise<boolean> {
  const tabId = await getCurrentHerdrTabId()
  if (!tabId) return false

  await execFileAsync("herdr", ["tab", "rename", tabId, name])
  return true
}

async function renameCurrentHerdrTabIfDefault(name: string): Promise<boolean> {
  const tab = await getCurrentHerdrTabInfo()
  if (!tab || tab.label?.trim() === name || !isDefaultHerdrTabLabel(tab)) {
    return false
  }

  await execFileAsync("herdr", ["tab", "rename", tab.id, name])
  return true
}

function hasSessionContextReader(
  value: unknown,
): value is SessionContextReader {
  return (
    typeof value === "object" &&
    value !== null &&
    "buildSessionContext" in value &&
    typeof value.buildSessionContext === "function"
  )
}

function getCurrentSessionMessages(ctx: ExtensionContext): AgentMessage[] {
  if (hasSessionContextReader(ctx.sessionManager)) {
    return ctx.sessionManager.buildSessionContext().messages
  }

  return buildSessionContext(
    ctx.sessionManager.getEntries(),
    ctx.sessionManager.getLeafId(),
  ).messages
}

async function applyRename(pi: ExtensionAPI, name: string): Promise<boolean> {
  pi.setSessionName(name)
  return renameCurrentHerdrTab(name)
}

async function runRenameCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: RenameState,
): Promise<void> {
  const context = getUserMessageContext(getCurrentSessionMessages(ctx))
  if (!context) {
    ctx.ui.notify("No conversation to rename yet.", "warning")
    return
  }

  const result = await generateRename(ctx, state.modelConfig, context)
  if (!result) {
    ctx.ui.notify("Could not generate a session name.", "error")
    return
  }

  let renamedHerdr = false
  let herdrError: string | undefined

  try {
    renamedHerdr = await applyRename(pi, result.name)
  } catch (error) {
    herdrError = error instanceof Error ? error.message : String(error)
  }

  if (result.source === "fallback") {
    ctx.ui.notify(
      [
        `Session renamed with fallback: ${result.name}`,
        `Could not use rename model: ${result.reason}`,
        ...(herdrError ? [`Herdr tab rename failed: ${herdrError}`] : []),
      ].join("\n"),
      "warning",
    )
    return
  }

  if (herdrError) {
    ctx.ui.notify(
      `Session renamed, but Herdr tab rename failed: ${herdrError}`,
      "warning",
    )
    return
  }

  ctx.ui.notify(
    renamedHerdr
      ? `Session and Herdr tab renamed: ${result.name}`
      : `Session renamed: ${result.name}`,
    "info",
  )
}

function getRenameArgumentCompletions(
  prefix: string,
): AutocompleteItem[] | null {
  const query = prefix.trimStart().toLowerCase()
  const items = RENAME_SUBCOMMANDS.filter((item) =>
    item.value.startsWith(query),
  )
  return items.length > 0 ? items : null
}

async function configureRenameModel(
  ctx: ExtensionContext,
  state: RenameState,
): Promise<void> {
  const models = await getAuthenticatedTextModelPreferences(ctx)
  if (models.length === 0) {
    ctx.ui.notify(
      "No authenticated models available. Run /login or configure a model first.",
      "error",
    )
    return
  }

  const result = await pickRenameModel(ctx, models)
  if (result.action === "cancel") return

  try {
    if (result.action === "default") {
      deleteRenameConfig()
      state.modelConfig = { kind: "missing" }
      ctx.ui.notify("Rename model reset to default.", "info")
      return
    }

    saveModelPreference(result.model)
    state.modelConfig = { kind: "configured", model: result.model }
    ctx.ui.notify(
      `Rename model set to ${formatRenameModelKey(result.model)}.`,
      "info",
    )
  } catch (error) {
    const reason =
      error instanceof SyntaxError ? "invalid JSON" : "write failed"
    ctx.ui.notify(`Could not update rename config: ${reason}.`, "error")
  }
}

async function notifyRenameStatus(
  ctx: ExtensionContext,
  state: RenameState,
): Promise<void> {
  let selectedModelLine = `selected model: ${formatModelPreference(state.modelConfig)}`
  let activeModelLine: string

  try {
    const modelAuth = await getRenameModelAuth(ctx, state.modelConfig)
    if (modelAuth.status === "ok") {
      const suffix = modelAuth.source === "default" ? " (default)" : ""
      selectedModelLine = `selected model: ${formatAuthModelKey(modelAuth.auth)}${suffix}`
      activeModelLine = `active model: ${formatAuthModelKey(modelAuth.auth)}`
    } else if (modelAuth.status === "invalid-config") {
      activeModelLine = "active model: none (invalid config)"
    } else {
      activeModelLine = "active model: none"
    }
  } catch {
    activeModelLine = "active model: unknown (auth check failed)"
  }

  const context = getUserMessageContext(getCurrentSessionMessages(ctx))
  const herdrLine = `herdr tab: ${process.env["HERDR_PANE_ID"]?.trim() ? "available" : "unavailable"}`
  const contextLine = `context: ${context?.count ?? 0} user messages`

  ctx.ui.notify(
    [
      "pi-rename status",
      selectedModelLine,
      activeModelLine,
      herdrLine,
      contextLine,
    ].join("\n"),
    "info",
  )
}

function registerRenameCommand(pi: ExtensionAPI, state: RenameState): void {
  pi.registerCommand("rename", {
    description: "generate a session name",
    getArgumentCompletions: getRenameArgumentCompletions,
    handler: async (args, ctx) => {
      const action = args.trim().split(/\s+/u)[0]?.toLowerCase() ?? ""

      if (!action) {
        await runRenameCommand(pi, ctx, state)
        return
      }

      if (action === "help") {
        ctx.ui.notify(
          [
            "pi-rename commands",
            "/rename - generate and apply a session name",
            "/rename status - show model and rename status",
            "/rename config - choose the rename model",
            "/rename help - show this help",
          ].join("\n"),
          "info",
        )
        return
      }

      if (action === "status") {
        await notifyRenameStatus(ctx, state)
        return
      }

      if (action === "config") {
        await configureRenameModel(ctx, state)
        return
      }

      ctx.ui.notify("Use /rename [config|help|status]", "error")
    },
  })
}

export default function (pi: ExtensionAPI): void {
  const state = createRenameState()

  registerRenameCommand(pi, state)

  pi.on("session_start", async () => {
    state.modelConfig = resolveInitialModelConfig()

    const sessionName = pi.getSessionName()?.trim()
    if (!sessionName) return

    try {
      await renameCurrentHerdrTabIfDefault(sessionName)
    } catch {
      // Keep session startup quiet if Herdr is unavailable or rejects the rename.
    }
  })
}
