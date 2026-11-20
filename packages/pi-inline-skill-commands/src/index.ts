import { readFileSync } from "node:fs"
import {
  CustomEditor,
  DefaultResourceLoader,
  getAgentDir,
  parseSkillBlock,
  SettingsManager,
  stripFrontmatter,
  type ExtensionAPI,
  type ExtensionContext,
  type InputSource,
  type ParsedSkillBlock,
  type Skill,
} from "@earendil-works/pi-coding-agent"
import type {
  AutocompleteProvider,
  EditorComponent,
} from "@earendil-works/pi-tui"

const MID_SKILL_BOUNDARY =
  "[\\s\\u3000\\u00a0\\u2007\\u202f\\u203f\\u2060\\ufeff，。！？；：、（）【】《》「」『』([{<`]"
const MID_SKILL_TOKEN = new RegExp(`(?:^|${MID_SKILL_BOUNDARY})(\\/[^\\s/]*)$`)
const MID_SKILL_COMMAND = new RegExp(`(^|${MID_SKILL_BOUNDARY})\\/skill:`)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Match only names Pi actually loaded, longest first, so `/skill:test_x` never falls back
 * to a shorter `test`. The lookahead still allows sentence punctuation (`.`, `,`, `，`).
 */
function buildSkillCommandPattern(skills: SkillMap): RegExp {
  const names = [...skills.keys()]
    .toSorted((a, b) => b.length - a.length)
    .map(escapeRegExp)
  return new RegExp(
    `(^|${MID_SKILL_BOUNDARY})(\\/skill:(${names.join("|")}))(?!\\.?[A-Za-z0-9_-])`,
  )
}

type SkillDefinition = Pick<Skill, "name" | "filePath" | "baseDir">
type SkillMap = ReadonlyMap<string, SkillDefinition>

interface TriggerableEditor extends EditorComponent {
  getCursor?: () => { line: number; col: number }
  isShowingAutocomplete?: () => boolean
  tryTriggerAutocomplete?: () => void
  inlineSkillCommandsTriggerInstalled?: boolean
}

export function extractMidSkillToken(
  textBeforeCursor: string,
): string | undefined {
  const token = textBeforeCursor.match(MID_SKILL_TOKEN)?.[1]
  if (!token) return undefined
  const beforeToken = textBeforeCursor.slice(0, -token.length)
  return beforeToken.trim() ? token : undefined
}

export function createMidSkillAutocompleteProvider(
  current: AutocompleteProvider,
): AutocompleteProvider {
  return {
    triggerCharacters: [
      ...new Set([...(current.triggerCharacters ?? []), "/"]),
    ],

    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const currentLine = lines[cursorLine] ?? ""
      const token = extractMidSkillToken(currentLine.slice(0, cursorCol))
      if (!token) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options)
      }

      const nativeLine = `/${token.slice(1)}`
      const nativeResult = await current.getSuggestions(
        [nativeLine],
        0,
        nativeLine.length,
        options,
      )
      const items = (nativeResult?.items ?? []).filter((item) =>
        item.value.startsWith("skill:"),
      )
      if (options.signal.aborted || items.length === 0) {
        return options.signal.aborted
          ? null
          : current.getSuggestions(lines, cursorLine, cursorCol, options)
      }
      return { items, prefix: token }
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      const currentLine = lines[cursorLine] ?? ""
      const beforeCursor = currentLine.slice(0, cursorCol)
      if (
        !item.value.startsWith("skill:") ||
        extractMidSkillToken(beforeCursor) !== prefix
      ) {
        return current.applyCompletion(
          lines,
          cursorLine,
          cursorCol,
          item,
          prefix,
        )
      }

      const beforePrefix = beforeCursor.slice(0, -prefix.length)
      const afterCursor = currentLine.slice(cursorCol)
      const replacement = `/${item.value}`
      const separator = /^\s/.test(afterCursor) ? "" : " "
      return {
        lines: lines.map((line, index) =>
          index === cursorLine
            ? beforePrefix + replacement + separator + afterCursor
            : line,
        ),
        cursorLine,
        cursorCol: beforePrefix.length + replacement.length + separator.length,
      }
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return (
        current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
        true
      )
    },
  }
}

export function expandMidSkillCommand(
  text: string,
  skills: SkillMap,
): string | undefined {
  // Idempotent: a second copy of this handler must not nest another skill block.
  if (text.startsWith("<skill ") || skills.size === 0) return undefined
  const match = buildSkillCommandPattern(skills).exec(text)
  if (!match) return undefined

  const boundary = match[1] ?? ""
  const prefix = text.slice(0, match.index + boundary.length)
  if (!prefix.trim()) return undefined

  const skill = skills.get(match[3] ?? "")
  if (!skill) return undefined

  const content = stripFrontmatter(readFileSync(skill.filePath, "utf-8")).trim()
  // Pi collapses a skill invocation only when the block starts the message. Keep the block
  // first and the original sentence, command included, as the user message. The references
  // line matches Pi's own expansion so both paths feed the model the same skill text.
  const block = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${content}\n</skill>`
  return `${block}\n\n${text.trim()}`
}

export function wrapMidSkillTrigger<T extends EditorComponent>(editor: T): T {
  const handleInput = editor.handleInput
  editor.handleInput = function (this: TriggerableEditor, data) {
    handleInput.call(this, data)
    if (
      !/^[a-zA-Z0-9\-_/]$/.test(data) ||
      this.isShowingAutocomplete?.() ||
      typeof this.tryTriggerAutocomplete !== "function"
    ) {
      return
    }
    const cursor = this.getCursor?.()
    const currentLine = cursor
      ? (this.getText().split("\n")[cursor.line] ?? "").slice(0, cursor.col)
      : ""
    if (extractMidSkillToken(currentLine) !== undefined) {
      this.tryTriggerAutocomplete()
    }
  }
  return editor
}

function installMidSkillTrigger(): void {
  // SAFETY: `handleInput` is an own property of CustomEditor.prototype and is replaced here;
  // the trigger members come from Editor.prototype and are feature-checked before use.
  const prototype = CustomEditor.prototype as unknown as TriggerableEditor
  if (prototype.inlineSkillCommandsTriggerInstalled) return
  wrapMidSkillTrigger(prototype)
  prototype.inlineSkillCommandsTriggerInstalled = true
}

async function loadSessionSkills(ctx: ExtensionContext): Promise<SkillMap> {
  const agentDir = getAgentDir()
  const settingsManager = SettingsManager.create(ctx.cwd, agentDir, {
    projectTrusted: ctx.isProjectTrusted(),
  })
  const loader = new DefaultResourceLoader({
    cwd: ctx.cwd,
    agentDir,
    settingsManager,
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  })
  await loader.reload()
  return new Map(
    loader
      .getSkills()
      .skills.map((skill) => [
        skill.name,
        { name: skill.name, filePath: skill.filePath, baseDir: skill.baseDir },
      ]),
  )
}

/** Rebuild the typed prompt from a stored skill block, keeping the command readable. */
function sessionNameFromBlock(block: ParsedSkillBlock): string {
  const rest = block.userMessage?.trim()
  // A body containing `</skill>` makes Pi's non-greedy envelope split early; the tail is not prose.
  if (!rest || rest.includes("<skill ") || rest.includes("</skill>")) {
    return `/skill:${block.name}`
  }
  const command = new RegExp(
    `(^|${MID_SKILL_BOUNDARY})/skill:${escapeRegExp(block.name)}(?![A-Za-z0-9_-])`,
  )
  return command.test(rest) ? rest : `/skill:${block.name} ${rest}`
}

function messageText(message: { content: unknown }): string {
  const content = message.content
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((part) => part?.type === "text")
    .map((part) => part.text as string)
    .join(" ")
}

/** First user message with non-blank text, so a text-less message never decides a name. */
function firstUserMessageText(ctx: ExtensionContext): string | undefined {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "message" || entry.message.role !== "user") continue
    const text = messageText(entry.message)
    if (text.trim()) return text
  }
  return undefined
}

export default function piInlineSkillCommands(pi: ExtensionAPI): void {
  let skillsPromise: Promise<SkillMap> | undefined
  installMidSkillTrigger()

  const getSkills = (ctx: ExtensionContext): Promise<SkillMap> => {
    skillsPromise ??= loadSessionSkills(ctx).catch((error: unknown) => {
      if (ctx.hasUI) {
        const message = error instanceof Error ? error.message : String(error)
        ctx.ui.notify(`Inline skill commands: ${message}`, "error")
      }
      return new Map()
    })
    return skillsPromise
  }

  pi.on("session_start", (_event, ctx) => {
    skillsPromise = undefined
    void getSkills(ctx)
    if (!ctx.hasUI) return

    ctx.ui.addAutocompleteProvider(createMidSkillAutocompleteProvider)
  })

  pi.on("input", async (event, ctx) => {
    if (!MID_SKILL_COMMAND.test(event.text)) return
    const text = expandMidSkillCommand(event.text, await getSkills(ctx))
    const nativeStart = event.text.trimStart().startsWith("/skill:")
    if (text === undefined && !nativeStart) return
    try {
      nameFirstSkillPrompt(pi, event.source, event.text, ctx)
    } catch {
      // A session name is cosmetic; never let it abort the expansion below.
    }
    return text === undefined ? undefined : { action: "transform", text }
  })

  pi.registerCommand("resume-session-name", {
    description:
      "Name this session from its first prompt instead of the expanded skill block",
    handler: async (_args, ctx) => {
      const first = firstUserMessageText(ctx)
      if (first === undefined) {
        ctx.ui.notify("This session has no user message with text yet", "info")
        return
      }
      const block = parseSkillBlock(first)
      if (!block) {
        ctx.ui.notify("The first message has no expanded skill block", "info")
        return
      }
      const name = sessionNameFromBlock(block)
      pi.setSessionName(name)
      ctx.ui.notify(`Session name set: ${pi.getSessionName() ?? name}`, "info")
    },
  })
}

/** A fresh session keeps the typed prompt as its name instead of the expanded block. */
function nameFirstSkillPrompt(
  pi: ExtensionAPI,
  source: InputSource,
  text: string,
  ctx: ExtensionContext,
): void {
  // Extension-authored prompts are not the user's first prompt.
  if (source === "extension") return
  if (ctx.sessionManager.getSessionName()) return
  // A text-less first message leaves `/resume` showing the block, so it must not block naming.
  if (firstUserMessageText(ctx) !== undefined) return
  const name = text.trim()
  if (name) pi.setSessionName(name)
}
