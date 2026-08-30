import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import piBark, {
  normalizeConfig,
  notificationTitle,
  resolveLocale,
} from "../src/index.ts"

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
    const ctx = { cwd: "/Users/herbertgao/VSCodeProject/pi", hasUI: true }
    await handlers.get("session_start")?.({}, ctx)
    await handlers.get("agent_settled")?.({}, ctx)
    busHandlers.get("rpiv:ask-user:prompt")?.({
      questions: [{ question: "SECRET: 选择发布方式？" }],
    })

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
      "💻 MacBook Pro M1 Max\n📁 /Users/herbertgao/VSCodeProject/pi",
    )
    assert.equal(requests[1]?.body.get("title"), "🟡 Pi 等你回答")
    assert.doesNotMatch(requests[1]?.body.get("body") ?? "", /SECRET/)

    await handlers.get("session_start")?.({}, { ...ctx, hasUI: false })
    await handlers.get("agent_settled")?.({}, ctx)
    assert.equal(requests.length, 2)

    await handlers.get("session_shutdown")?.({}, ctx)
    assert.equal(busHandlers.has("rpiv:ask-user:prompt"), false)
    assert.equal(resolveLocale("zh-Hant-HK"), "zh-TW")
    assert.equal(
      notificationTitle("zh-TW", "askUserQuestion"),
      "🟡 Pi 等你回覆",
    )
    assert.equal(notificationTitle("en", "agentSettled"), "✅ Pi finished")
    assert.equal(normalizeConfig({ endpoint: "file:///tmp/key" }), undefined)
  } finally {
    globalThis.fetch = previousFetch
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir
    rmSync(agentDir, { recursive: true, force: true })
  }
})
