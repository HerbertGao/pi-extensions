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
import { parseSkillBlock } from "@earendil-works/pi-coding-agent"
import { CustomEditor } from "@earendil-works/pi-coding-agent"
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
  const skills = new Map([
    ["test", { name: "test", filePath, baseDir: directory }],
  ])

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
    `<skill name="test" location="${filePath}">\nReferences are relative to ${directory}.\n\nUse the skill body.\n</skill>\n\nPlease use /skill:test to explain this`,
  )

  // Pi collapses a skill invocation only when the block starts the message.
  const expanded = expandMidSkillCommand(
    "Please use /skill:test to explain this",
    skills,
  )
  assert.ok(expanded)
  const parsed = parseSkillBlock(expanded)
  assert.ok(parsed)
  assert.equal(parsed.name, "test")
  assert.equal(parsed.location, filePath)
  assert.equal(
    parsed.content,
    `References are relative to ${directory}.\n\nUse the skill body.`,
  )
  assert.equal(parsed.userMessage, "Please use /skill:test to explain this")

  // The command ends at any non-name character, not only whitespace.
  for (const prompt of [
    "Please use (/skill:test) here",
    "Use `/skill:test` here",
    "请使用，/skill:test，然后总结",
    "Please use /skill:test?",
    "Please use /skill:test.",
  ]) {
    const result = expandMidSkillCommand(prompt, skills)
    assert.ok(result, prompt)
    assert.equal(parseSkillBlock(result)?.userMessage, prompt)
  }

  // A name character after the command keeps it part of the skill name, so an unknown
  // longer token is a no-op instead of silently expanding a shorter prefix skill.
  for (const prompt of [
    "Please use /skill:testing here",
    "Please use /skill:test_x here",
    "Please use /skill:test.notes here",
  ]) {
    assert.equal(expandMidSkillCommand(prompt, skills), undefined, prompt)
  }

  // Loaded names win over a shorter prefix, longest first.
  const longerFiles = ["test_x", "test.notes"]
  const withLonger = new Map(skills)
  for (const name of longerFiles) {
    const path = join(directory, `${name}.md`)
    writeFileSync(path, `---\nname: ${name}\ndescription: d\n---\nBody.\n`)
    withLonger.set(name, { name, filePath: path, baseDir: directory })
  }
  for (const name of longerFiles) {
    const result = expandMidSkillCommand(
      `Please use /skill:${name} here`,
      withLonger,
    )
    assert.ok(result)
    assert.equal(parseSkillBlock(result)?.name, name)
  }

  // A second copy of the handler must not nest another block.
  assert.equal(expandMidSkillCommand(expanded, skills), undefined)
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
    event: { text: string; source: "interactive" | "rpc" | "extension" },
    ctx: ExtensionContext,
  ) => Promise<{ action: "transform"; text: string } | undefined>
  const pi = createFakePi()
  piInlineSkillCommands(pi)
  const inputHandler = pi.inputHandler as unknown as InputHandler | undefined

  // A second install (standalone package plus aggregate) chains a second handler.
  const secondPi = createFakePi()
  piInlineSkillCommands(secondPi)
  const chainedHandler = secondPi.inputHandler as unknown as
    | InputHandler
    | undefined

  const ctx = {
    cwd: directory,
    hasUI: false,
    isProjectTrusted: () => false,
    sessionManager: {
      getSessionName: () => undefined,
      getEntries: () => [],
    },
  } as unknown as ExtensionContext

  assert.ok(inputHandler)
  const result = await inputHandler(
    { text: "Please use /skill:test to explain this", source: "interactive" },
    ctx,
  )
  assert.ok(result)
  assert.equal(result.action, "transform")
  assert.match(result.text, /^<skill name="test" location="/)
  assert.match(
    result.text,
    /<\/skill>\n\nPlease use \/skill:test to explain this$/,
  )
  assert.ok(parseSkillBlock(result.text))

  assert.ok(chainedHandler)
  assert.equal(
    await chainedHandler({ text: result.text, source: "interactive" }, ctx),
    undefined,
    "second handler must not nest another block",
  )
  assert.equal(
    await inputHandler(
      { text: "/skill:test explain this", source: "interactive" },
      ctx,
    ),
    undefined,
  )
})

test("wraps the editor trigger only at mid-text token boundaries", () => {
  // The trigger wrapper depends on these private members; fail loudly if Pi renames them.
  const prototype = CustomEditor.prototype as unknown as Record<string, unknown>
  assert.equal(Object.hasOwn(prototype, "handleInput"), true)
  assert.equal(typeof prototype.handleInput, "function")
  assert.equal(typeof prototype.tryTriggerAutocomplete, "function")
  assert.equal(typeof prototype.isShowingAutocomplete, "function")
  assert.equal(typeof prototype.getCursor, "function")

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

type FakePi = ExtensionAPI & {
  names: string[]
  commands: Map<string, (args: string, ctx: ExtensionContext) => Promise<void>>
  inputHandler?: (
    event: { text: string; source?: "interactive" | "rpc" | "extension" },
    ctx: ExtensionContext,
  ) => Promise<unknown>
}

function createFakePi(): FakePi {
  const fake = {
    names: [] as string[],
    commands: new Map<
      string,
      (args: string, ctx: ExtensionContext) => Promise<void>
    >(),
    inputHandler: undefined as FakePi["inputHandler"],
    setSessionName: (name: string) => fake.names.push(name),
    getSessionName: () => fake.names.at(-1),
    on: (event: string, handler: unknown) => {
      if (event === "input")
        fake.inputHandler = handler as FakePi["inputHandler"]
    },
    registerCommand: (
      name: string,
      options: {
        handler: (args: string, ctx: ExtensionContext) => Promise<void>
      },
    ) => {
      fake.commands.set(name, options.handler)
    },
  }
  return fake as unknown as FakePi
}

function createFakeContext(options: {
  name?: string
  messages?: string[]
  contents?: Array<
    string | Array<{ type: string; text?: string; [key: string]: unknown }>
  >
}) {
  const notes: string[] = []
  const contents =
    options.contents ?? (options.messages ?? []).map((message) => message)
  const entries = contents.map((content) => ({
    type: "message",
    message: { role: "user", content },
  }))
  const ctx = {
    cwd: process.cwd(),
    hasUI: true,
    isProjectTrusted: () => false,
    sessionManager: {
      getSessionName: () => options.name,
      getEntries: () => entries,
    },
    ui: { notify: (message: string) => notes.push(message) },
  }
  return { ctx: ctx as unknown as ExtensionContext, notes }
}

test("names a fresh session with the typed prompt, not the expanded block", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pi-inline-skill-name-"))
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
    "---\nname: test\ndescription: Test skill\n---\nBody.\n",
  )

  const pi = createFakePi()
  piInlineSkillCommands(pi)

  const fresh = createFakeContext({})
  await pi.inputHandler?.(
    { text: "根据这种形式做一下检查 /skill:test", source: "interactive" },
    fresh.ctx,
  )
  assert.deepEqual(pi.names, ["根据这种形式做一下检查 /skill:test"])

  // A native start-of-prompt command is named too.
  await pi.inputHandler?.(
    { text: "/skill:test argue this", source: "interactive" },
    createFakeContext({}).ctx,
  )
  assert.equal(pi.names[1], "/skill:test argue this")

  // Non-TUI modes persist sessions that show up in /resume, so they name too.
  await pi.inputHandler?.(
    { text: "Use /skill:test here", source: "rpc" },
    createFakeContext({}).ctx,
  )
  assert.equal(pi.names.length, 3)

  // Later prompts, user-chosen names, and extension-authored prompts are left alone.
  await pi.inputHandler?.(
    { text: "Use /skill:test here", source: "interactive" },
    createFakeContext({ name: "mine" }).ctx,
  )
  await pi.inputHandler?.(
    { text: "Use /skill:test here", source: "interactive" },
    createFakeContext({ messages: ["first prompt"] }).ctx,
  )
  await pi.inputHandler?.(
    { text: "Use /skill:test here", source: "extension" },
    createFakeContext({}).ctx,
  )
  assert.equal(pi.names.length, 3)

  // A prompt without a skill command never renames.
  await pi.inputHandler?.(
    { text: "just a normal request", source: "interactive" },
    fresh.ctx,
  )
  assert.equal(pi.names.length, 3)

  // A mid-prompt command for a skill that is not loaded does not expand, so it is not named.
  await pi.inputHandler?.(
    { text: "Use /skill:missing here", source: "interactive" },
    createFakeContext({}).ctx,
  )
  assert.equal(pi.names.length, 3)

  // A text-less first message must not block naming: `/resume` skips it too.
  await pi.inputHandler?.(
    { text: "检查一下 /skill:test", source: "interactive" },
    createFakeContext({
      contents: [[{ type: "image", data: "x", mimeType: "image/png" }]],
    }).ctx,
  )
  assert.equal(pi.names[3], "检查一下 /skill:test")

  // The name is trimmed before it is stored.
  await pi.inputHandler?.(
    { text: "  /skill:test argue this", source: "interactive" },
    createFakeContext({}).ctx,
  )
  assert.equal(pi.names[4], "/skill:test argue this")

  // A failing rename must never cost the expansion.
  const failing = createFakePi()
  failing.setSessionName = () => {
    throw new Error("session write failed")
  }
  piInlineSkillCommands(failing)
  const expanded = (await failing.inputHandler?.(
    { text: "Use /skill:test here", source: "interactive" },
    createFakeContext({}).ctx,
  )) as { action: string; text: string } | undefined
  assert.equal(expanded?.action, "transform")
  assert.match(expanded?.text ?? "", /^<skill name="test"/)
})

test("resume-session-name rebuilds the typed prompt from a stored block", async () => {
  const pi = createFakePi()
  piInlineSkillCommands(pi)
  const command = pi.commands.get("resume-session-name")
  assert.ok(command)

  const midPrompt = createFakeContext({
    messages: [
      `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\n根据这种形式做一下检查 /skill:test`,
    ],
  })
  await command("", midPrompt.ctx)
  assert.deepEqual(pi.names, ["根据这种形式做一下检查 /skill:test"])

  const nativePrompt = createFakeContext({
    messages: [
      `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\nexplain this`,
    ],
  })
  await command("", nativePrompt.ctx)
  assert.equal(pi.names[1], "/skill:test explain this")

  // Native args that merely mention a skill command keep the skill name.
  const mentions = createFakeContext({
    messages: [
      `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\nwrite about /skill:other usage`,
    ],
  })
  await command("", mentions.ctx)
  assert.equal(pi.names[2], "/skill:test write about /skill:other usage")

  // A prefix of another command still reads as prose, not as this block's command.
  const nearMiss = createFakeContext({
    messages: [
      `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\ncompare /skill:testing`,
    ],
  })
  await command("", nearMiss.ctx)
  assert.equal(pi.names[3], "/skill:test compare /skill:testing")

  // A dotted longer name is a different command, exactly as the expansion pattern treats it.
  const dotted = createFakeContext({
    messages: [
      `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\ncompare /skill:test.notes`,
    ],
  })
  await command("", dotted.ctx)
  assert.equal(pi.names[4], "/skill:test compare /skill:test.notes")

  // Expansion allows CJK punctuation before the command, so the rebuild must too.
  const cjk = createFakeContext({
    messages: [
      `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\n检查一下，/skill:test`,
    ],
  })
  await command("", cjk.ctx)
  assert.equal(pi.names[5], "检查一下，/skill:test")

  // A body containing `</skill>` splits Pi's envelope early; do not use the tail as a name.
  const split = createFakeContext({
    messages: [
      `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\nleftover </skill> do it`,
    ],
  })
  await command("", split.ctx)
  assert.equal(pi.names[6], "/skill:test")

  // Stored user messages carry content parts, not a bare string.
  const parts = createFakeContext({
    contents: [
      [
        {
          type: "text",
          text: `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\nargue this`,
        },
      ],
    ],
  })
  await command("", parts.ctx)
  assert.equal(pi.names[7], "/skill:test argue this")

  // A text-less first message is skipped, the way `/resume` builds `firstMessage`.
  const imageOnly = createFakeContext({
    contents: [
      [{ type: "image", data: "x", mimeType: "image/png" }],
      `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\nargue this`,
    ],
  })
  await command("", imageOnly.ctx)
  assert.equal(pi.names[8], "/skill:test argue this")

  // Empty userMessage falls back to the command alone.
  const empty = createFakeContext({
    messages: [`<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>`],
  })
  await command("", empty.ctx)
  assert.equal(pi.names[9], "/skill:test")

  const plain = createFakeContext({ messages: ["no skill here"] })
  await command("", plain.ctx)
  assert.equal(pi.names.length, 10)
  assert.match(plain.notes.at(-1) ?? "", /no expanded skill block/)

  const none = createFakeContext({})
  await command("", none.ctx)
  assert.equal(pi.names.length, 10)
  assert.match(none.notes.at(-1) ?? "", /no user message with text/)

  // Text parts are joined with one space, like Pi's `firstMessage`.
  const splitParts = createFakeContext({
    contents: [
      [
        {
          type: "text",
          text: `<skill name="test" location="/tmp/SKILL.md">\nBody.\n</skill>\n\nexplain`,
        },
        { type: "text", text: "this" },
      ],
    ],
  })
  await command("", splitParts.ctx)
  assert.equal(pi.names[10], "/skill:test explain this")
})
