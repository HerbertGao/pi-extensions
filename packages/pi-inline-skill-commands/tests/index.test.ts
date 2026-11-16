import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { CombinedAutocompleteProvider } from "@earendil-works/pi-tui"
import type { EditorComponent } from "@earendil-works/pi-tui"
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import piInlineSkillCommands, {
  createMidSkillAutocompleteProvider,
  expandMidSkillCommand,
  extractMidSkillToken,
  wrapMidSkillTrigger,
} from "../src/index.ts"

const autocompleteOptions = { signal: new AbortController().signal }

test("mid-text completion lists only skills and preserves surrounding text", async () => {
  const current = new CombinedAutocompleteProvider(
    [
      { name: "model", description: "Switch model" },
      { name: "skill:test", description: "Test skill" },
      { name: "skill:deep-research", description: "Research deeply" },
    ],
    process.cwd(),
  )
  const provider = createMidSkillAutocompleteProvider(current)

  const bareLine = "Please use /"
  const bare = await provider.getSuggestions(
    [bareLine],
    0,
    bareLine.length,
    autocompleteOptions,
  )
  assert.ok(bare)
  assert.ok(bare.items.length > 0)
  assert.ok(bare.items.every((item) => item.value.startsWith("skill:")))

  const line = "Please use /deep and report back"
  const cursorCol = line.indexOf(" and")
  const result = await provider.getSuggestions(
    [line],
    0,
    cursorCol,
    autocompleteOptions,
  )
  assert.ok(result)
  assert.deepStrictEqual(
    result.items.map((item) => item.value),
    ["skill:deep-research"],
  )
  const item = result.items[0]
  assert.ok(item)
  const applied = provider.applyCompletion(
    [line],
    0,
    cursorCol,
    item,
    result.prefix,
  )
  assert.equal(
    applied.lines[0],
    "Please use /skill:deep-research and report back",
  )
  assert.equal(applied.cursorCol, "Please use /skill:deep-research".length)

  const start = await provider.getSuggestions(
    ["/mo"],
    0,
    3,
    autocompleteOptions,
  )
  assert.ok(start?.items.some((candidate) => candidate.value === "model"))
  const midOrdinary = await provider.getSuggestions(
    ["Use /model"],
    0,
    "Use /model".length,
    autocompleteOptions,
  )
  assert.equal(midOrdinary, null)
})

test("recognizes token boundaries without treating URLs or paths as skills", () => {
  assert.equal(extractMidSkillToken("/"), undefined)
  assert.equal(extractMidSkillToken("  /"), undefined)
  assert.equal(extractMidSkillToken("Please use /"), "/")
  assert.equal(extractMidSkillToken("请使用，/sk"), "/sk")
  assert.equal(extractMidSkillToken("See https://"), undefined)
  assert.equal(extractMidSkillToken("Open /tmp/demo"), undefined)
})

test("expands a mid-text skill while leaving native start commands alone", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pi-inline-skill-commands-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const filePath = join(directory, "SKILL.md")
  writeFileSync(
    filePath,
    "---\nname: test\ndescription: Test skill\n---\n\nUse the skill body.\n",
  )
  const skills = new Map([["test", { name: "test", filePath }]])

  assert.equal(
    expandMidSkillCommand("/skill:test explain this", skills),
    undefined,
  )
  assert.equal(
    expandMidSkillCommand("Please use /skill:missing to explain this", skills),
    undefined,
  )
  assert.equal(
    expandMidSkillCommand("See https://example.test/skill:test", skills),
    undefined,
  )
  assert.equal(
    expandMidSkillCommand("Please use /skill:test to explain this", skills),
    `Please use <skill name="test" location="${filePath}">\nUse the skill body.\n</skill>\n\nto explain this`,
  )
})

test("input handler loads session skills and transforms mid-text commands", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pi-inline-skill-input-"))
  const agentDir = join(directory, "agent")
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR
  t.after(() => {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir
    rmSync(directory, { recursive: true, force: true })
  })
  process.env.PI_CODING_AGENT_DIR = agentDir
  mkdirSync(join(agentDir, "skills", "test"), { recursive: true })
  writeFileSync(
    join(agentDir, "skills", "test", "SKILL.md"),
    "---\nname: test\ndescription: Test skill\n---\nUse the skill body.\n",
  )

  type InputHandler = (
    event: { text: string },
    ctx: ExtensionContext,
  ) => Promise<{ action: "transform"; text: string } | undefined>
  let inputHandler: InputHandler | undefined
  const pi = {
    on: (event: string, handler: unknown) => {
      if (event === "input") inputHandler = handler as InputHandler
    },
  } as unknown as ExtensionAPI
  piInlineSkillCommands(pi)
  const ctx = {
    cwd: directory,
    hasUI: false,
    isProjectTrusted: () => false,
  } as unknown as ExtensionContext

  assert.ok(inputHandler)
  const result = await inputHandler(
    { text: "Please use /skill:test to explain this" },
    ctx,
  )
  assert.ok(result)
  assert.equal(result.action, "transform")
  assert.match(result.text, /^Please use <skill name="test" location="/)
  assert.match(result.text, /<\/skill>\n\nto explain this$/)
  assert.equal(
    await inputHandler({ text: "/skill:test explain this" }, ctx),
    undefined,
  )
})

test("wraps the editor trigger only at mid-text token boundaries", () => {
  let text = "Use "
  let cursor = text.length
  let triggers = 0
  const editor = {
    getText: () => text,
    getCursor: () => ({ line: 0, col: cursor }),
    handleInput: (data: string) => {
      text = text.slice(0, cursor) + data + text.slice(cursor)
      cursor += data.length
    },
    isShowingAutocomplete: () => false,
    tryTriggerAutocomplete: () => {
      triggers += 1
    },
  } as unknown as EditorComponent
  wrapMidSkillTrigger(editor)

  editor.handleInput("/")
  assert.equal(triggers, 1)
  assert.equal(text, "Use /")

  text = "https:"
  cursor = text.length
  editor.handleInput("/")
  assert.equal(triggers, 1)

  text = ""
  cursor = 0
  editor.handleInput("/")
  assert.equal(triggers, 1)
})
