import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import piBark, {
  formatDuration,
  normalizeConfig,
  notificationTitle,
  resolveLocale,
  resolveSessionTitle,
  truncateTitle,
} from "../src/index.ts"

const CWD = "/Users/herbertgao/VSCodeProject/pi"

/** Longer than UI_PROMPT_FALLBACK_DELAY_MS so the deferred ask-user fallback settles. */
const afterFallback = () => new Promise((resolve) => setTimeout(resolve, 500))

test("notifies only user-facing sessions when Pi settles or asks a question", async () => {
  const agentDir = mkdtempSync(join(tmpdir(), "pi-bark-"))
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR
  const previousFetch = globalThis.fetch
  const requests: Array<{ url: string; body: URLSearchParams }> = []
  const handlers = new Map<string, (...args: any[]) => unknown>()
  const busHandlers = new Map<string, (payload: unknown) => unknown>()

  writeFileSync(
    join(agentDir, "bark.json"),
    JSON.stringify({
      endpoint: "https://example.test/device-key",
      machine: "MacBook Pro M1 Max",
      locale: "zh-CN",
      params: {
        group: "pi",
        icon: "https://example.test/pi-icon.png",
        sound: "bell",
      },
    }),
  )
  process.env.PI_CODING_AGENT_DIR = agentDir
  globalThis.fetch = (async (input, init) => {
    requests.push({
      url: String(input),
      body: init?.body as URLSearchParams,
    })
    return new Response(null, { status: 200 })
  }) as typeof fetch

  const pi = {
    on: (event: string, handler: (...args: any[]) => unknown) => {
      handlers.set(event, handler)
    },
    events: {
      on: (event: string, handler: (payload: unknown) => unknown) => {
        busHandlers.set(event, handler)
        return () => busHandlers.delete(event)
      },
    },
  } as unknown as ExtensionAPI

  try {
    piBark(pi)
    const ctx = { cwd: CWD, hasUI: true }
    await handlers.get("session_start")?.({}, ctx)
    await handlers.get("agent_settled")?.({}, ctx)
    busHandlers.get("rpiv:ask-user:prompt")?.({
      questions: [{ question: "SECRET: 选择发布方式？" }],
    })
    await afterFallback()

    assert.equal(requests.length, 2)
    assert.equal(requests[0]?.url, "https://example.test/device-key")
    assert.equal(requests[0]?.body.get("title"), "✅ Pi 跑完了")
    assert.equal(requests[0]?.body.get("group"), "pi")
    assert.equal(
      requests[0]?.body.get("icon"),
      "https://example.test/pi-icon.png",
    )
    assert.equal(
      requests[0]?.body.get("body"),
      `💻 MacBook Pro M1 Max\n📁 ${CWD}`,
    )
    assert.equal(requests[1]?.body.get("title"), "🟡 Pi 等你回答")
    assert.doesNotMatch(requests[1]?.body.get("body") ?? "", /SECRET/)

    await handlers.get("session_start")?.({}, { ...ctx, hasUI: false })
    await handlers.get("agent_settled")?.({}, ctx)
    assert.equal(requests.length, 2)

    await handlers.get("session_shutdown")?.({}, ctx)
    assert.equal(busHandlers.has("rpiv:ask-user:prompt"), false)
    assert.equal(resolveLocale("zh-Hant-HK"), "zh-TW")
    assert.equal(notificationTitle("zh-TW", "needsInput"), "🟡 Pi 等你回覆")
    assert.equal(notificationTitle("en", "agentSettled"), "✅ Pi finished")
    assert.equal(normalizeConfig({ endpoint: "file:///tmp/key" }), undefined)
  } finally {
    globalThis.fetch = previousFetch
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir
    rmSync(agentDir, { recursive: true, force: true })
  }
})

interface Harness {
  requests: Array<{ url: string; body: URLSearchParams }>
  handlers: Map<string, (...args: any[]) => unknown>
  busHandlers: Map<string, (payload: unknown) => unknown>
  ctx: { cwd: string; hasUI: boolean; sessionManager: unknown }
  dispose: () => void
}

function createHarness(options: {
  config?: Record<string, unknown>
  sessionName?: string
  userMessages?: string[]
  hasUI?: boolean
}): Harness {
  const agentDir = mkdtempSync(join(tmpdir(), "pi-bark-"))
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR
  const previousFetch = globalThis.fetch
  const requests: Harness["requests"] = []
  const handlers: Harness["handlers"] = new Map()
  const busHandlers: Harness["busHandlers"] = new Map()

  writeFileSync(
    join(agentDir, "bark.json"),
    JSON.stringify({
      endpoint: "https://example.test/device-key",
      machine: "MacBook Pro M1 Max",
      locale: "zh-CN",
      ...options.config,
    }),
  )
  process.env.PI_CODING_AGENT_DIR = agentDir
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), body: init?.body as URLSearchParams })
    return new Response(null, { status: 200 })
  }) as typeof fetch

  const pi = {
    on: (event: string, handler: (...args: any[]) => unknown) => {
      handlers.set(event, handler)
    },
    events: {
      on: (event: string, handler: (payload: unknown) => unknown) => {
        busHandlers.set(event, handler)
        return () => busHandlers.delete(event)
      },
    },
    getSessionName: () => options.sessionName,
  } as unknown as ExtensionAPI

  piBark(pi)

  return {
    requests,
    handlers,
    busHandlers,
    ctx: {
      cwd: CWD,
      hasUI: options.hasUI ?? true,
      sessionManager: {
        getSessionName: () => options.sessionName,
        getEntries: () =>
          (options.userMessages ?? []).map((text) => ({
            type: "message",
            message: { role: "user", content: text },
          })),
      },
    },
    dispose: () => {
      globalThis.fetch = previousFetch
      if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR
      else process.env.PI_CODING_AGENT_DIR = previousAgentDir
      rmSync(agentDir, { recursive: true, force: true })
    },
  }
}

test("uses the session title and the run duration when title.source is session", async () => {
  const h = createHarness({
    config: { title: { source: "session", maxLength: 40 } },
    userMessages: [
      "Please reply with exactly the single word ok and nothing else at all",
    ],
  })
  try {
    await h.handlers.get("session_start")?.({}, h.ctx)
    await h.handlers.get("agent_start")?.({}, h.ctx)
    await h.handlers.get("agent_settled")?.({}, h.ctx)

    assert.equal(h.requests.length, 1)
    assert.equal(
      h.requests[0]?.body.get("title"),
      "Please reply with exactly the single wo…",
    )
    assert.equal(
      h.requests[0]?.body.get("body"),
      `✅ 已完成 · 用时 0s\n💻 MacBook Pro M1 Max\n📁 ${CWD}`,
    )
  } finally {
    h.dispose()
  }
})

test("prefers Pi's session name over the first user message", async () => {
  const h = createHarness({
    config: { title: { source: "session" } },
    sessionName: "Fix the flaky test",
    userMessages: ["a much longer first message that would otherwise be used"],
  })
  try {
    await h.handlers.get("session_start")?.({}, h.ctx)
    await h.handlers.get("ui_prompt_start")?.({ kind: "confirm" }, h.ctx)

    assert.equal(h.requests.length, 1)
    assert.equal(h.requests[0]?.body.get("title"), "Fix the flaky test")
    assert.equal(
      h.requests[0]?.body.get("body"),
      `🟡 需要你回复\n💻 MacBook Pro M1 Max\n📁 ${CWD}`,
    )
  } finally {
    h.dispose()
  }
})

test("notifies once when both ui_prompt_start and the ask-user event fire", async () => {
  const h = createHarness({
    config: { title: { source: "session" } },
    userMessages: ["ask me something"],
  })
  try {
    await h.handlers.get("session_start")?.({}, h.ctx)
    await h.handlers.get("ui_prompt_start")?.({ kind: "custom" }, h.ctx)
    h.busHandlers.get("rpiv:ask-user:prompt")?.({
      questions: [{ question: "SECRET: 选择发布方式？" }],
    })
    await afterFallback()

    assert.equal(h.requests.length, 1)
    assert.equal(h.requests[0]?.body.get("title"), "ask me something")
    assert.equal(
      h.requests[0]?.body.get("body")?.split("\n")[0],
      "🟡 需要你回复",
    )
    assert.doesNotMatch(h.requests[0]?.body.get("body") ?? "", /SECRET/)
  } finally {
    h.dispose()
  }
})

test("falls back to the ask-user event when ui_prompt_start never fires", async () => {
  const h = createHarness({
    config: { title: { source: "session" } },
    userMessages: ["ask me something"],
  })
  try {
    await h.handlers.get("session_start")?.({}, h.ctx)
    h.busHandlers.get("rpiv:ask-user:prompt")?.({ questions: [] })
    assert.equal(h.requests.length, 0)

    await afterFallback()
    assert.equal(h.requests.length, 1)
    assert.equal(h.requests[0]?.body.get("title"), "ask me something")
    assert.equal(
      h.requests[0]?.body.get("body")?.split("\n")[0],
      "🟡 需要你回复",
    )
  } finally {
    h.dispose()
  }
})

test("silences a settle that finishes under minDurationMs", async () => {
  const h = createHarness({ config: { minDurationMs: 60_000 } })
  try {
    await h.handlers.get("session_start")?.({}, h.ctx)
    await h.handlers.get("agent_start")?.({}, h.ctx)
    await h.handlers.get("agent_settled")?.({}, h.ctx)

    assert.equal(h.requests.length, 0)
  } finally {
    h.dispose()
  }
})

test("still honors the legacy events.askUserQuestion name", async () => {
  const h = createHarness({
    config: { events: { askUserQuestion: false } },
  })
  try {
    await h.handlers.get("session_start")?.({}, h.ctx)
    await h.handlers.get("ui_prompt_start")?.({ kind: "confirm" }, h.ctx)

    assert.equal(h.requests.length, 0)
  } finally {
    h.dispose()
  }
})

test("does not notify in a session without a user-facing UI", async () => {
  const h = createHarness({
    config: { title: { source: "session" } },
    userMessages: ["hidden"],
    hasUI: false,
  })
  try {
    await h.handlers.get("session_start")?.({}, h.ctx)
    await h.handlers.get("ui_prompt_start")?.({ kind: "confirm" }, h.ctx)
    await h.handlers.get("agent_start")?.({}, h.ctx)
    await h.handlers.get("agent_settled")?.({}, h.ctx)

    assert.equal(h.requests.length, 0)
  } finally {
    h.dispose()
  }
})

test("truncateTitle collapses whitespace and counts the ellipsis", () => {
  assert.equal(truncateTitle("a\n\nb   c", 40), "a b c")
  assert.equal(truncateTitle("x".repeat(50), 40), `${"x".repeat(39)}…`)
  assert.equal(truncateTitle("short", 40), "short")
})

test("formatDuration renders seconds, minutes, and hours", () => {
  assert.equal(formatDuration(0), "0s")
  assert.equal(formatDuration(45_400), "45s")
  assert.equal(formatDuration(134_000), "2m14s")
  assert.equal(formatDuration(120_000), "2m")
  assert.equal(formatDuration(3_780_000), "1h3m")
  assert.equal(formatDuration(3_600_000), "1h")
})

test("resolveSessionTitle walks name, then first non-empty user message", () => {
  assert.equal(
    resolveSessionTitle(
      {
        sessionManager: {
          getSessionName: () => "named session",
          getEntries: () => [],
        },
      } as never,
      () => undefined,
    ),
    "named session",
  )
  assert.equal(
    resolveSessionTitle(
      {
        sessionManager: {
          getSessionName: () => undefined,
          getEntries: () => [
            { type: "message", message: { role: "user", content: "  " } },
            {
              type: "message",
              message: {
                role: "user",
                content: [{ type: "text", text: "the   first" }],
              },
            },
          ],
        },
      } as never,
      () => undefined,
    ),
    "the first",
  )
  assert.equal(
    resolveSessionTitle(undefined, () => undefined),
    "",
  )
})
