import { readFileSync } from "node:fs"
import {
  CustomEditor,
  DefaultResourceLoader,
  getAgentDir,
  SettingsManager,
  stripFrontmatter,
  type ExtensionAPI,
  type ExtensionContext,
  type Skill,
} from "@earendil-works/pi-coding-agent"
import type {
  AutocompleteProvider,
  EditorComponent,
} from "@earendil-works/pi-tui"

const MID_SKILL_TOKEN =
  /(?:^|[\s\u3000\u00a0\u2007\u202f\u203f\u2060\ufeff，。！？；：、（）【】《》「」『』([{<`])(\/[^\s/]*)$/
const MID_SKILL_COMMAND =
  /(^|[\s\u3000\u00a0\u2007\u202f\u203f\u2060\ufeff，。！？；：、（）【】《》「」『』([{<`])(\/skill:([a-z0-9-]{1,64}))(?=\s|$)/

type SkillDefinition = Pick<Skill, "name" | "filePath">
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
  const match = MID_SKILL_COMMAND.exec(text)
  if (!match) return undefined

  const boundary = match[1] ?? ""
  const command = match[2] ?? ""
  const commandIndex = match.index + boundary.length
  const prefix = text.slice(0, commandIndex)
  if (!prefix.trim()) return undefined

  const skill = skills.get(match[3] ?? "")
  if (!skill) return undefined

  const content = stripFrontmatter(readFileSync(skill.filePath, "utf-8")).trim()
  const args = text.slice(commandIndex + command.length).trim()
  let expansion = `<skill name="${skill.name}" location="${skill.filePath}">\n${content}\n</skill>`
  if (args) expansion += `\n\n${args}`
  return prefix + expansion
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
  // SAFETY: CustomEditor has these runtime members; the private trigger is feature-checked before use.
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
  return new Map(loader.getSkills().skills.map((skill) => [skill.name, skill]))
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
    return text === undefined ? undefined : { action: "transform", text }
  })
}
