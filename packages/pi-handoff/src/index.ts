import type { AgentMessage } from "@earendil-works/pi-agent-core"
import { complete, type Message } from "@earendil-works/pi-ai/compat"
import {
  generateRename,
  getUserMessageContext,
  sanitizeRenameText,
} from "@herbertgao/pi-rename/naming"
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  SessionEntry,
  SlashCommandInfo,
} from "@earendil-works/pi-coding-agent"
import {
  BorderedLoader,
  convertToLlm,
  serializeConversation,
} from "@earendil-works/pi-coding-agent"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const HANDOFF_SKILL_COMMAND = "skill:handoff"

const HANDOFF_SYSTEM_PROMPT = `You are a context transfer assistant. Generate a handoff markdown document for a fresh coding agent.

Follow the provided handoff skill instructions as the document policy.

Requirements:
- Base the handoff only on the supplied conversation and session metadata.
- Tailor the document to the next session focus.
- Include concrete decisions, files, commands/checks, blockers, and next steps when relevant.
- Include a "Suggested skills" section.
- Reference existing artifacts by path or URL instead of duplicating their content.
- Redact sensitive information such as API keys, passwords, tokens, and personally identifiable information.
- Keep it concise and actionable.
- Output only markdown for the handoff document. Do not include a preamble or closing note.`

type HandoffSkill = {
  path: string
  instructions: string
}

function entryToMessage(entry: SessionEntry): AgentMessage | undefined {
  if (entry.type === "message") return entry.message
  if (entry.type === "compaction") {
    return {
      role: "compactionSummary",
      summary: entry.summary,
      tokensBefore: entry.tokensBefore,
      timestamp: new Date(entry.timestamp).getTime(),
    }
  }
  return undefined
}

function getHandoffMessages(branch: SessionEntry[]): AgentMessage[] {
  let compactionIndex = -1
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index]?.type === "compaction") {
      compactionIndex = index
      break
    }
  }

  if (compactionIndex < 0) {
    return branch.map(entryToMessage).filter((message) => message !== undefined)
  }

  const compaction = branch[compactionIndex]
  const firstKeptIndex =
    compaction?.type === "compaction"
      ? branch.findIndex((entry) => entry.id === compaction.firstKeptEntryId)
      : -1
  const compactedBranch = [
    compaction,
    ...(firstKeptIndex >= 0
      ? branch.slice(firstKeptIndex, compactionIndex)
      : []),
    ...branch.slice(compactionIndex + 1),
  ].filter((entry) => entry !== undefined)

  return compactedBranch
    .map(entryToMessage)
    .filter((message) => message !== undefined)
}

async function loadHandoffSkill(
  pi: ExtensionAPI,
): Promise<HandoffSkill | undefined> {
  const command = pi
    .getCommands()
    .find(
      (candidate: SlashCommandInfo) =>
        candidate.source === "skill" &&
        candidate.name === HANDOFF_SKILL_COMMAND,
    )
  if (!command?.sourceInfo.path) return undefined

  return {
    path: command.sourceInfo.path,
    instructions: await readFile(command.sourceInfo.path, "utf8"),
  }
}

function textFromMessage(message: AgentMessage): string | undefined {
  if (message.role !== "user") return undefined
  const content = message.content
  if (typeof content === "string") return content.trim()
  if (!Array.isArray(content)) return undefined

  return content
    .filter((part): part is { type: "text"; text: string } => {
      return (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      )
    })
    .map((part) => part.text)
    .join("\n")
    .trim()
}

function dateStamp(): string {
  const [date] = new Date().toISOString().split("T")
  return date ?? "handoff"
}

async function nextHandoffPath(slug: string): Promise<string> {
  const directory = join(tmpdir(), "pi-handoffs")
  await mkdir(directory, { recursive: true })

  const baseName = `pi-handoff-${dateStamp()}-${slug}`
  for (let index = 1; index < 1000; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`
    const path = join(directory, `${baseName}${suffix}.md`)
    if (!existsSync(path)) return path
  }

  throw new Error("Could not allocate a unique handoff file path")
}

async function generateSessionName(
  ctx: ExtensionCommandContext,
  messages: readonly AgentMessage[],
): Promise<string> {
  const context = getUserMessageContext(messages)
  if (!context) return "handoff-session"

  const result = await generateRename(ctx, { kind: "missing" }, context)
  return result?.name ?? "handoff-session"
}

function buildNewSessionPrompt(handoffPath: string): string {
  return [
    "Continue from this handoff:",
    handoffPath,
    "Read the handoff, load any suggested skills, then continue the work.",
  ].join("\n\n")
}

function summarizePromptContext(ctx: ExtensionCommandContext): string {
  const promptOptions = ctx.getSystemPromptOptions()
  const skills = (promptOptions.skills ?? [])
    .map((skill) => skill.name)
    .toSorted()
  const contextFiles = (promptOptions.contextFiles ?? [])
    .map((file) => file.path)
    .toSorted()

  const lines = ["## Loaded pi context", ""]
  lines.push("### Skills", "")
  lines.push(
    ...(skills.length > 0 ? skills.map((name) => `- \`${name}\``) : ["- None"]),
  )
  lines.push("", "### Context files", "")
  lines.push(
    ...(contextFiles.length > 0
      ? contextFiles.map((filePath) => `- \`${filePath}\``)
      : ["- None"]),
  )
  return lines.join("\n")
}

function buildDocumentWithMetadata(options: {
  generated: string
  focus: string
  handoffSkillPath: string
  parentSession: string | undefined
  promptContext: string
}): string {
  const previousSession = options.parentSession
    ? [
        "## Previous session",
        "",
        `- Session file: \`${options.parentSession}\``,
        "- If details are missing, use `session_query` with that session file.",
      ].join("\n")
    : [
        "## Previous session",
        "",
        "- No persisted previous session file was available.",
      ].join("\n")

  return [
    `# Handoff: ${options.focus}`,
    "",
    "## Next session focus",
    "",
    options.focus,
    "",
    previousSession,
    "",
    options.promptContext,
    "",
    "## Handoff policy",
    "",
    "- Skill: `handoff`",
    `- Source: \`${options.handoffSkillPath}\``,
    "",
    options.generated.trim(),
    "",
  ].join("\n")
}

async function generateHandoffDocument(options: {
  ctx: ExtensionCommandContext
  handoffSkill: HandoffSkill
  messages: AgentMessage[]
  focus: string
  parentSession: string | undefined
  signal?: AbortSignal
}): Promise<string | null> {
  const model = options.ctx.model
  if (!model) throw new Error("No model selected")

  const auth = await options.ctx.modelRegistry.getApiKeyAndHeaders(model)
  if (!auth.ok) throw new Error(auth.error)

  const conversationText = serializeConversation(convertToLlm(options.messages))
  const userMessage: Message = {
    role: "user",
    content: [
      {
        type: "text",
        text: [
          "## Handoff Skill Instructions",
          "",
          options.handoffSkill.instructions,
          "",
          "## Session Metadata",
          "",
          `- Previous session file: ${options.parentSession ?? "not available"}`,
          `- Handoff skill path: ${options.handoffSkill.path}`,
          "",
          "## Next Session Focus",
          "",
          options.focus,
          "",
          "## Conversation History",
          "",
          conversationText,
        ].join("\n"),
      },
    ],
    timestamp: Date.now(),
  }

  const response = await complete(
    model,
    { systemPrompt: HANDOFF_SYSTEM_PROMPT, messages: [userMessage] },
    {
      ...(auth.apiKey ? { apiKey: auth.apiKey } : {}),
      ...(auth.headers ? { headers: auth.headers } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  )

  if (response.stopReason === "aborted") return null

  return response.content
    .filter((content): content is { type: "text"; text: string } => {
      return content.type === "text"
    })
    .map((content) => content.text)
    .join("\n")
    .trim()
}

export default function (pi: ExtensionAPI): void {
  pi.registerCommand("handoff-session", {
    description:
      "Create a new session from a handoff generated by the handoff skill",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("handoff-session requires interactive TUI mode.", "error")
        return
      }

      if (!ctx.model) {
        ctx.ui.notify("No model selected.", "error")
        return
      }

      const handoffSkill = await loadHandoffSkill(pi)
      if (!handoffSkill) {
        ctx.ui.notify(
          "handoff-session requires a discoverable skill named exactly `handoff`. Install it, then run /reload.",
          "error",
        )
        return
      }

      const focus = (
        await ctx.ui.input(
          "What will the next session be used for?",
          "continue the current work",
        )
      )?.trim()
      if (!focus) {
        ctx.ui.notify("Handoff session cancelled.", "warning")
        return
      }

      const branch = ctx.sessionManager.getBranch()
      const messages = getHandoffMessages(branch)
      if (messages.length === 0) {
        ctx.ui.notify("No conversation to hand off.", "error")
        return
      }

      const parentSession = ctx.sessionManager.getSessionFile() ?? undefined
      const generated = await ctx.ui.custom<string | null>(
        (tui, theme, _kb, done) => {
          const model = ctx.model
          const modelLabel = model
            ? `${model.provider}/${"id" in model ? model.id : "selected"}`
            : "selected model"
          const loader = new BorderedLoader(
            tui,
            theme,
            `Generating handoff with ${modelLabel}...`,
          )
          loader.onAbort = () => done(null)

          generateHandoffDocument({
            ctx: ctx as ExtensionCommandContext,
            handoffSkill,
            messages,
            focus,
            parentSession,
            signal: loader.signal,
          })
            .then(done)
            .catch((error) => {
              console.error("Handoff generation failed:", error)
              done(
                `__ERROR__${error instanceof Error ? error.message : String(error)}`,
              )
            })

          return loader
        },
      )

      if (generated === null) {
        ctx.ui.notify("Handoff session cancelled.", "warning")
        return
      }
      if (generated.startsWith("__ERROR__")) {
        ctx.ui.notify(generated.slice("__ERROR__".length), "error")
        return
      }

      const sessionName = await generateSessionName(
        ctx as ExtensionCommandContext,
        messages,
      )
      const firstUserText = messages.map(textFromMessage).find(Boolean)
      const handoffSlug =
        sanitizeRenameText(pi.getSessionName() ?? firstUserText ?? focus) ||
        "session"
      const handoffPath = await nextHandoffPath(handoffSlug)
      const document = buildDocumentWithMetadata({
        generated,
        focus,
        handoffSkillPath: handoffSkill.path,
        parentSession,
        promptContext: summarizePromptContext(ctx as ExtensionCommandContext),
      })
      await writeFile(handoffPath, document, "utf8")

      await (ctx as ExtensionCommandContext).newSession({
        ...(parentSession ? { parentSession } : {}),
        setup: async (sessionManager) => {
          sessionManager.appendSessionInfo(sessionName)
        },
        withSession: async (newCtx) => {
          newCtx.ui.setEditorText(buildNewSessionPrompt(handoffPath))
          newCtx.ui.notify(`Handoff written: ${handoffPath}`, "info")
        },
      })
    },
  })
}
