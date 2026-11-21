/**
 * Cross-package contract: real pi-subagents RPC handlers wired to pi-agency
 * and pi-cc-extensions badge client — no mocked register/list replies.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { rpcRegisterAgents } from "../../pi-agency/src/index.ts"
import {
  agentBadge,
  clearAgentBadges,
  initAgentBadges,
} from "../../pi-cc-extensions/extensions/renderer/tool/agent-badge.ts"
import { renderAgentName } from "../src/agent-color.js"
import { clearEphemeralAgents, registerAgents } from "../src/agent-types.js"
import {
  type EventBus,
  registerRpcHandlers,
} from "../src/cross-extension-rpc.js"

function createEventBus(): EventBus {
  const listeners = new Map<string, Set<(data: unknown) => void>>()
  const emitted: Array<{ event: string; data: unknown }> = []
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(handler)
      return () => {
        listeners.get(event)?.delete(handler)
      }
    },
    emit(event, data) {
      emitted.push({ event, data })
      for (const handler of listeners.get(event) ?? []) handler(data)
    },
    /** Test-only: bus emissions for assertions. */
    get emitted() {
      return emitted
    },
  } as EventBus & { emitted: Array<{ event: string; data: unknown }> }
}

const theme = {
  fg: (_c: string, t: string) => t,
  bold: (t: string) => `*${t}*`,
  getColorMode: () => "truecolor" as const,
}

describe("identity bus contract", () => {
  let events: EventBus & { emitted: Array<{ event: string; data: unknown }> }
  let teardown: ReturnType<typeof registerRpcHandlers> | undefined

  const manager = {
    spawn: () => "id",
    awaitStartup: async () => {},
    abort: () => true,
    waitForSettled: async () => true,
    isSettling: () => false,
    getRecord: () => undefined,
    listAgents: () => [],
    isNotificationPending: () => false,
    consumeResult: () => false,
    steer: () => false,
  }

  beforeEach(() => {
    events = createEventBus()
    clearEphemeralAgents()
    registerAgents(new Map())
    clearAgentBadges()
    teardown = registerRpcHandlers({
      events,
      manager,
      workflows: { get: () => undefined, list: () => [] },
      pi: {},
      getCtx: () => ({}),
    })
  })

  afterEach(() => {
    for (const fn of Object.values(teardown ?? {})) {
      if (typeof fn === "function") fn()
    }
  })

  it("agency_register seats a type via the real register-agents handler", async () => {
    await rpcRegisterAgents(
      events,
      [
        {
          name: "MCP Builder",
          description: "Expert MCP developer.",
          systemPrompt: "You are MCP Builder.",
          color: "indigo",
        },
      ],
      "none",
      2000,
    )
    expect(
      events.emitted.some(({ event }) => event === "subagents:agents-changed"),
    ).toBe(true)
  })

  it("ccstyle pulls the type color table and refreshes on agents-changed", async () => {
    initAgentBadges(events, 2000)
    events.emit("subagents:ready", {})
    await new Promise((r) => setTimeout(r, 30))
    expect(agentBadge("Code Reviewer", theme)).toBeUndefined()

    await rpcRegisterAgents(
      events,
      [
        {
          name: "Code Reviewer",
          description: "Reviews code",
          systemPrompt: "You are a reviewer.",
          color: "purple",
        },
      ],
      "none",
      2000,
    )
    await new Promise((r) => setTimeout(r, 30))
    expect(agentBadge("Code Reviewer", theme)).toContain("Code Reviewer")

    const unreg = new Promise((resolve) => {
      events.on("subagents:rpc:unregister-agents:reply:unreg-contract", resolve)
      events.emit("subagents:rpc:unregister-agents", {
        requestId: "unreg-contract",
        names: ["Code Reviewer"],
      })
    })
    await expect(unreg).resolves.toEqual({ success: true })
    await new Promise((r) => setTimeout(r, 30))
    expect(agentBadge("Code Reviewer", theme)).toBeUndefined()
  })

  it("renderAgentName prefers a run label only for general-purpose", () => {
    expect(renderAgentName("general-purpose", theme, {}, "My Run")).toBe(
      "My Run",
    )
    expect(renderAgentName("Explore", theme, {}, "My Run")).toBe("Explore")
  })

  it("get/list workflow RPC still answer while identity channels are present", async () => {
    const ping = await new Promise((resolve) => {
      events.on("subagents:rpc:ping:reply:ping-c", resolve)
      events.emit("subagents:rpc:ping", { requestId: "ping-c" })
    })
    expect(
      (ping as { data?: { features?: string[] } }).data?.features,
    ).toContain("list")
    const list = await new Promise((resolve) => {
      events.on("subagents:rpc:list:reply:list-c", resolve)
      events.emit("subagents:rpc:list", { requestId: "list-c" })
    })
    expect(list).toEqual({ success: true, data: { agents: [] } })
  })
})
