import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearEphemeralAgents,
  getAgentConfig,
  registerAgents,
} from "../src/agent-types.js"
import {
  type EventBus,
  FEATURES,
  PROTOCOL_VERSION,
  type RpcDeps,
  registerRpcHandlers,
  type SpawnCapable,
  STOP_SETTLE_TIMEOUT_MAX_MS,
  STOP_SETTLE_TIMEOUT_MS,
  type WorkflowReader,
} from "../src/cross-extension-rpc.js"
import {
  isScopeModelsEnabled,
  setScopeModelsEnabled,
} from "../src/model-scope.js"
import type { WorkflowDetail, WorkflowInfo } from "../src/workflow-info.js"

/** Minimal manager stub for identity RPC tests. */
function identityManagerStub() {
  return {
    spawn: vi.fn(),
    awaitStartup: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockReturnValue(true),
    waitForSettled: vi.fn().mockResolvedValue(true),
    isSettling: vi.fn().mockReturnValue(false),
    getRecord: vi.fn(),
    listAgents: vi.fn().mockReturnValue([]),
    isNotificationPending: vi.fn().mockReturnValue(false),
    consumeResult: vi.fn(),
    steer: vi.fn(),
  }
}

function identityWorkflowsStub(): WorkflowReader {
  return {
    get: vi.fn(),
    list: vi.fn().mockReturnValue([]),
  }
}

/** Simple in-process event bus for testing. */
function createEventBus(): EventBus {
  const listeners = new Map<string, Set<(data: unknown) => void>>()
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(handler)
      return () => {
        listeners.get(event)?.delete(handler)
      }
    },
    emit(event, data) {
      for (const handler of listeners.get(event) ?? []) handler(data)
    },
  }
}

describe("cross-extension RPC", () => {
  let events: EventBus
  let manager: SpawnCapable
  let workflows: WorkflowReader
  let ctx: object | undefined
  let deps: RpcDeps

  beforeEach(() => {
    events = createEventBus()
    manager = {
      spawn: vi.fn().mockReturnValue("agent-42"),
      awaitStartup: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockReturnValue(true),
      waitForSettled: vi.fn().mockResolvedValue(true),
      isSettling: vi.fn().mockReturnValue(false),
      getRecord: vi.fn().mockReturnValue({}),
      listAgents: vi.fn().mockReturnValue([]),
      isNotificationPending: vi.fn().mockReturnValue(false),
      consumeResult: vi.fn().mockReturnValue(true),
      steer: vi.fn().mockReturnValue(true),
    }
    workflows = {
      get: vi.fn().mockReturnValue(undefined),
      list: vi.fn().mockReturnValue([]),
    }
    ctx = { session: true }
    deps = { events, pi: { events }, getCtx: () => ctx, manager, workflows }
  })

  // --- ping ---

  describe("ping RPC", () => {
    it("replies with protocol version and features", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:ping:reply:req-1", reply)
      events.emit("subagents:rpc:ping", { requestId: "req-1" })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: true,
        data: { version: PROTOCOL_VERSION, features: [...FEATURES] },
      })
    })

    // Consumers feature-detect on these strings, so the list is a contract:
    // adding, renaming or dropping one must be a deliberate change here.
    it("pins the feature list", () => {
      expect([...FEATURES]).toEqual([
        "consume",
        "steer",
        "get",
        "list",
        "owned-lifecycle",
        "stop-settles",
        "settling",
        "notification-pending",
        "workflow-events",
        "workflow-get",
        "workflow-list",
        "workflow-result",
        "workflow-args",
        "workflow-logs",
      ])
    })

    it("scopes replies — other requestIds do not receive it", async () => {
      registerRpcHandlers(deps)
      const wrongReply = vi.fn()
      events.on("subagents:rpc:ping:reply:req-other", wrongReply)
      events.emit("subagents:rpc:ping", { requestId: "req-1" })

      await new Promise((r) => setTimeout(r, 20))
      expect(wrongReply).not.toHaveBeenCalled()
    })

    it("unsub stops responding to pings", async () => {
      const { unsubPing } = registerRpcHandlers(deps)
      unsubPing()

      const reply = vi.fn()
      events.on("subagents:rpc:ping:reply:req-1", reply)
      events.emit("subagents:rpc:ping", { requestId: "req-1" })

      await new Promise((r) => setTimeout(r, 20))
      expect(reply).not.toHaveBeenCalled()
    })
  })

  // --- workflow_get / workflow_list ---

  describe("workflow RPC", () => {
    const info: WorkflowInfo = {
      id: "wf_1",
      name: "demo",
      status: "running",
      startedAt: 1000,
      durationMs: 50,
      agentCount: 2,
      doneCount: 1,
      failedCount: 0,
      totalTokens: 10,
      totalToolCalls: 3,
      phaseLabel: "Scan (1/2)",
    }
    const detail: WorkflowDetail = {
      ...info,
      version: 4,
      agents: [
        { index: 0, label: "a0", state: "done" },
        { index: 1, label: "a1", state: "start" },
      ],
    }

    it("workflow_get returns the run's detail, agents and version included", async () => {
      ;(workflows.get as any).mockImplementation((id: string) =>
        id === "wf_1" ? detail : undefined,
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:workflow_get:reply:req-wg", reply)
      events.emit("subagents:rpc:workflow_get", {
        requestId: "req-wg",
        workflowId: "wf_1",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: true,
        data: { workflow: detail },
      })
      expect(workflows.get).toHaveBeenCalledWith("wf_1")
    })

    it("workflow_get reports 'Workflow not found' for an unknown id", async () => {
      registerRpcHandlers(deps) // workflows.get returns undefined by default
      const reply = vi.fn()
      events.on("subagents:rpc:workflow_get:reply:req-wg2", reply)
      events.emit("subagents:rpc:workflow_get", {
        requestId: "req-wg2",
        workflowId: "nope",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Workflow not found",
      })
    })

    it("workflow_list returns summaries, without the per-agent snapshot", async () => {
      ;(workflows.list as any).mockReturnValue([info])
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:workflow_list:reply:req-wl", reply)
      events.emit("subagents:rpc:workflow_list", { requestId: "req-wl" })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: true,
        data: { workflows: [info] },
      })
      expect(
        (reply.mock.calls[0][0] as any).data.workflows[0],
      ).not.toHaveProperty("agents")
    })

    it("unsub stops responding to workflow_get", async () => {
      const { unsubWorkflowGet } = registerRpcHandlers(deps)
      unsubWorkflowGet()
      const reply = vi.fn()
      events.on("subagents:rpc:workflow_get:reply:req-wg3", reply)
      events.emit("subagents:rpc:workflow_get", {
        requestId: "req-wg3",
        workflowId: "wf_1",
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(reply).not.toHaveBeenCalled()
    })
  })

  // --- spawn ---

  describe("spawn RPC", () => {
    it("returns agent id on success", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-s1", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-s1",
        type: "general-purpose",
        prompt: "do stuff",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: true,
        data: { id: "agent-42" },
      })
      expect(manager.spawn).toHaveBeenCalledWith(
        deps.pi,
        ctx,
        "general-purpose",
        "do stuff",
        {},
      )
    })

    it("passes options through to manager.spawn", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-s2", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-s2",
        type: "Explore",
        prompt: "find it",
        options: { description: "search", isBackground: true },
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(manager.spawn).toHaveBeenCalledWith(
        deps.pi,
        ctx,
        "Explore",
        "find it",
        { description: "search", isBackground: true },
      )
    })

    it("returns error when no active session", async () => {
      ctx = undefined
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-s3", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-s3",
        type: "general-purpose",
        prompt: "x",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "No active session",
      })
      expect(manager.spawn).not.toHaveBeenCalled()
    })

    it("returns error when manager.spawn throws", async () => {
      ;(manager.spawn as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("unknown agent type")
      })
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-s4", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-s4",
        type: "bad-type",
        prompt: "x",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "unknown agent type",
      })
    })

    it("returns error when the agent fails to start after spawn returns", async () => {
      // With isolation: "worktree" the agent is not running when spawn() hands
      // back an id — the repo copy is an awaited git call. A failure there has
      // to be an error envelope, not an id for an agent that never ran.
      ;(manager.awaitStartup as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Cannot run with isolation: "worktree"'),
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-s4b", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-s4b",
        type: "general-purpose",
        prompt: "x",
        options: { isolation: "worktree" },
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot run with isolation: "worktree"',
      })
      expect(manager.awaitStartup).toHaveBeenCalledWith("agent-42")
    })

    it("scopes replies — other requestIds do not receive it", async () => {
      registerRpcHandlers(deps)
      const wrongReply = vi.fn()
      const rightReply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-other", wrongReply)
      events.on("subagents:rpc:spawn:reply:req-s5", rightReply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-s5",
        type: "general-purpose",
        prompt: "x",
      })

      await vi.waitFor(() => expect(rightReply).toHaveBeenCalled())
      expect(wrongReply).not.toHaveBeenCalled()
    })

    it("unsub stops responding to spawns", async () => {
      const { unsubSpawn } = registerRpcHandlers(deps)
      unsubSpawn()

      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-s6", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-s6",
        type: "general-purpose",
        prompt: "x",
      })

      // Give any potential async handler time to fire
      await new Promise((r) => setTimeout(r, 20))
      expect(reply).not.toHaveBeenCalled()
    })
  })

  // --- stop ---

  describe("stop RPC", () => {
    // The default double reports a record with neither owner field, i.e. one of
    // the session's own agents — the case the ownership guard must let through.
    it("returns success when agent is aborted", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-st1", reply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st1",
        agentId: "agent-42",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: true,
        data: { settled: true },
      })
      expect(manager.abort).toHaveBeenCalledWith("agent-42")
    })

    // #443: a caller that starts replacement work on the reply must not race a
    // tool call the stopped agent, or an agent it owns, still has in flight.
    it("replies only once the agent and its owned agents have settled", async () => {
      let settle!: (settled: boolean) => void
      ;(manager.waitForSettled as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise<boolean>((r) => {
          settle = r
        }),
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-st9", reply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st9",
        agentId: "agent-42",
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(manager.abort).toHaveBeenCalledWith("agent-42")
      expect(manager.waitForSettled).toHaveBeenCalledWith(
        "agent-42",
        STOP_SETTLE_TIMEOUT_MS,
      )
      expect(reply).not.toHaveBeenCalled()

      settle(false)
      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: true,
        data: { settled: false },
      })
    })

    it("waits less than the 10 s pi-tasks gives the stop reply", () => {
      expect(STOP_SETTLE_TIMEOUT_MS).toBeLessThan(10_000)
    })

    // `abort` returning false no longer means "no such agent" — the handler's
    // own lookup covers that, and the only case left is a record that is neither
    // running nor queued, i.e. one that has already finished.
    it("says so when the agent exists but has already finished", async () => {
      ;(manager.abort as ReturnType<typeof vi.fn>).mockReturnValue(false)
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-st2", reply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st2",
        agentId: "settled",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Agent is not running",
      })
    })

    // A repeat stop after `settled: false`: the agent is no longer running, so
    // there is nothing to abort, but its tree is still unwinding.
    it("waits again when the agent has finished but its tree is still settling", async () => {
      ;(manager.abort as ReturnType<typeof vi.fn>).mockReturnValue(false)
      ;(manager.isSettling as ReturnType<typeof vi.fn>).mockReturnValue(true)
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-st10", reply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st10",
        agentId: "agent-42",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: true,
        data: { settled: true },
      })
      expect(manager.isSettling).toHaveBeenCalledWith("agent-42")
      expect(manager.waitForSettled).toHaveBeenCalledWith(
        "agent-42",
        STOP_SETTLE_TIMEOUT_MS,
      )
    })

    it.each([
      [20, 20],
      [0, 0],
      [-5, 0],
      [STOP_SETTLE_TIMEOUT_MAX_MS + 1, STOP_SETTLE_TIMEOUT_MAX_MS],
    ])("waits settleTimeoutMs %s as %s ms", async (given, used) => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-st11", reply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st11",
        agentId: "agent-42",
        settleTimeoutMs: given,
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(manager.waitForSettled).toHaveBeenCalledWith("agent-42", used)
    })

    it.each([["5000"], [Number.NaN], [Number.POSITIVE_INFINITY], [null]])(
      "rejects settleTimeoutMs %s without aborting",
      async (given) => {
        registerRpcHandlers(deps)
        const reply = vi.fn()
        events.on("subagents:rpc:stop:reply:req-st12", reply)
        events.emit("subagents:rpc:stop", {
          requestId: "req-st12",
          agentId: "agent-42",
          settleTimeoutMs: given,
        })

        await vi.waitFor(() => expect(reply).toHaveBeenCalled())
        expect(reply).toHaveBeenCalledWith({
          success: false,
          error: "settleTimeoutMs must be a number of milliseconds",
        })
        expect(manager.abort).not.toHaveBeenCalled()
      },
    )

    it("returns error when the agent is unknown to the manager", async () => {
      ;(manager.getRecord as ReturnType<typeof vi.fn>).mockReturnValue(
        undefined,
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-st5", reply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st5",
        agentId: "nonexistent",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Agent not found",
      })
      expect(manager.abort).not.toHaveBeenCalled()
    })

    // A nested child and a workflow's agent both have an owner that is waiting
    // on them, so an id that leaked to another extension must not let it abort
    // one out from under that owner.
    it("refuses to stop another agent's nested child", async () => {
      ;(manager.getRecord as ReturnType<typeof vi.fn>).mockReturnValue({
        parentAgentId: "agent-1",
      })
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-st6", reply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st6",
        agentId: "agent-child",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Agent is owned by another agent or workflow",
      })
      expect(manager.abort).not.toHaveBeenCalled()
    })

    it("refuses to stop a workflow's agent", async () => {
      ;(manager.getRecord as ReturnType<typeof vi.fn>).mockReturnValue({
        workflowId: "wf-1",
      })
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-st7", reply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st7",
        agentId: "agent-wf",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Agent is owned by another agent or workflow",
      })
      expect(manager.abort).not.toHaveBeenCalled()
    })

    it("scopes replies — other requestIds do not receive it", async () => {
      registerRpcHandlers(deps)
      const wrongReply = vi.fn()
      const rightReply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-other", wrongReply)
      events.on("subagents:rpc:stop:reply:req-st3", rightReply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st3",
        agentId: "agent-42",
      })

      await vi.waitFor(() => expect(rightReply).toHaveBeenCalled())
      expect(wrongReply).not.toHaveBeenCalled()
    })

    it("unsub stops responding to stop requests", async () => {
      const { unsubStop } = registerRpcHandlers(deps)
      unsubStop()

      const reply = vi.fn()
      events.on("subagents:rpc:stop:reply:req-st4", reply)
      events.emit("subagents:rpc:stop", {
        requestId: "req-st4",
        agentId: "agent-42",
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(reply).not.toHaveBeenCalled()
    })
  })

  // --- consume ---

  describe("consume RPC", () => {
    it("returns success when the result is consumed", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:consume:reply:req-c1", reply)
      events.emit("subagents:rpc:consume", {
        requestId: "req-c1",
        agentId: "agent-42",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({ success: true })
      expect(manager.consumeResult).toHaveBeenCalledWith("agent-42")
    })

    it("returns an error when the agent is unknown or still running", async () => {
      ;(manager.consumeResult as ReturnType<typeof vi.fn>).mockReturnValue(
        false,
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:consume:reply:req-c2", reply)
      events.emit("subagents:rpc:consume", {
        requestId: "req-c2",
        agentId: "agent-42",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Agent not found or still running",
      })
    })

    it("unsub stops responding to consume requests", async () => {
      const { unsubConsume } = registerRpcHandlers(deps)
      unsubConsume()

      const reply = vi.fn()
      events.on("subagents:rpc:consume:reply:req-c3", reply)
      events.emit("subagents:rpc:consume", {
        requestId: "req-c3",
        agentId: "agent-42",
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(reply).not.toHaveBeenCalled()
      expect(manager.consumeResult).not.toHaveBeenCalled()
    })
  })

  // --- steer ---

  describe("steer RPC", () => {
    it("delivers a message to a running top-level agent", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:steer:reply:req-m1", reply)
      events.emit("subagents:rpc:steer", {
        requestId: "req-m1",
        agentId: "agent-42",
        message: "also failing: check_suite on 839ab295",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({ success: true })
      expect(manager.steer).toHaveBeenCalledWith(
        "agent-42",
        "also failing: check_suite on 839ab295",
      )
    })

    it("returns error when the agent is unknown to the manager", async () => {
      ;(manager.getRecord as ReturnType<typeof vi.fn>).mockReturnValue(
        undefined,
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:steer:reply:req-m2", reply)
      events.emit("subagents:rpc:steer", {
        requestId: "req-m2",
        agentId: "nonexistent",
        message: "x",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Agent not found",
      })
      expect(manager.steer).not.toHaveBeenCalled()
    })

    // Same ownership stance as stop: an agent another agent or a workflow is
    // waiting on is not this RPC's to redirect.
    it("refuses to steer another agent's nested child or a workflow's agent", async () => {
      ;(manager.getRecord as ReturnType<typeof vi.fn>).mockReturnValue({
        workflowId: "wf-1",
      })
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:steer:reply:req-m3", reply)
      events.emit("subagents:rpc:steer", {
        requestId: "req-m3",
        agentId: "agent-42",
        message: "x",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Agent is owned by another agent or workflow",
      })
      expect(manager.steer).not.toHaveBeenCalled()
    })

    it("says so when the agent has already finished", async () => {
      ;(manager.steer as ReturnType<typeof vi.fn>).mockReturnValue(false)
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:steer:reply:req-m4", reply)
      events.emit("subagents:rpc:steer", {
        requestId: "req-m4",
        agentId: "agent-42",
        message: "x",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Agent is not running",
      })
    })

    it("rejects a whitespace-only message before touching the manager", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:steer:reply:req-m5", reply)
      events.emit("subagents:rpc:steer", {
        requestId: "req-m5",
        agentId: "agent-42",
        message: "   ",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Steer message must be a non-empty string",
      })
      expect(manager.steer).not.toHaveBeenCalled()
    })

    it("rejects a non-string message before touching the manager", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:steer:reply:req-m7", reply)
      events.emit("subagents:rpc:steer", {
        requestId: "req-m7",
        agentId: "agent-42",
        message: 42,
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Steer message must be a non-empty string",
      })
      expect(manager.steer).not.toHaveBeenCalled()
    })

    it("unsub stops responding to steer requests", async () => {
      const { unsubSteer } = registerRpcHandlers(deps)
      unsubSteer()

      const reply = vi.fn()
      events.on("subagents:rpc:steer:reply:req-m6", reply)
      events.emit("subagents:rpc:steer", {
        requestId: "req-m6",
        agentId: "agent-42",
        message: "x",
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(reply).not.toHaveBeenCalled()
    })
  })

  // --- get / list ---

  describe("get and list RPCs", () => {
    const record = (over: Record<string, unknown>) => ({
      id: "agent-42",
      type: "Explore",
      description: "audit",
      status: "completed",
      toolUses: 2,
      startedAt: 1000,
      completedAt: 3000,
      result: "done",
      abortController: new AbortController(),
      lifetimeUsage: { input: 0, output: 0, cacheWrite: 0 },
      ownUsage: { input: 0, output: 0, cacheWrite: 0 },
      compactionCount: 0,
      ...over,
    })

    it("get returns the agent's public fields, never the live record", async () => {
      ;(manager.getRecord as ReturnType<typeof vi.fn>).mockReturnValue(
        record({ structuredJson: '{"ok":true}' }),
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:get:reply:req-g1", reply)
      events.emit("subagents:rpc:get", {
        requestId: "req-g1",
        agentId: "agent-42",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      const agent = reply.mock.calls[0][0].data.agent
      expect(agent).toMatchObject({
        id: "agent-42",
        status: "completed",
        durationMs: 2000,
        result: "done",
        structuredJson: '{"ok":true}',
      })
      expect(agent).not.toHaveProperty("abortController")
      expect(manager.getRecord).toHaveBeenCalledWith("agent-42")
    })

    // A read is harmless, so it does not take stop's ownership guard: an owned
    // agent comes back with the owner field that says whose it is.
    it("get answers for a workflow's agent", async () => {
      ;(manager.getRecord as ReturnType<typeof vi.fn>).mockReturnValue(
        record({ workflowId: "wf-1" }),
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:get:reply:req-g2", reply)
      events.emit("subagents:rpc:get", {
        requestId: "req-g2",
        agentId: "agent-42",
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply.mock.calls[0][0]).toEqual({
        success: true,
        data: { agent: expect.objectContaining({ workflowId: "wf-1" }) },
      })
    })

    it("get returns error when the agent is unknown", async () => {
      ;(manager.getRecord as ReturnType<typeof vi.fn>).mockReturnValue(
        undefined,
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:get:reply:req-g3", reply)
      events.emit("subagents:rpc:get", { requestId: "req-g3", agentId: "gone" })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: false,
        error: "Agent not found",
      })
    })

    it("list returns every record the manager holds, in any status", async () => {
      ;(manager.listAgents as ReturnType<typeof vi.fn>).mockReturnValue([
        record({ id: "a1", status: "running", completedAt: undefined }),
        record({ id: "a2", parentAgentId: "a1", depth: 2 }),
      ])
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:list:reply:req-l1", reply)
      events.emit("subagents:rpc:list", { requestId: "req-l1" })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      const agents = reply.mock.calls[0][0].data.agents
      expect(agents.map((a: any) => [a.id, a.status, a.parentAgentId])).toEqual(
        [
          ["a1", "running", undefined],
          ["a2", "completed", "a1"],
        ],
      )
    })

    // `settling` qualifies a terminal status; on a running agent it would only
    // restate `status`, so it is left off.
    it("marks a terminal agent whose tree is still running as settling, and only that one", async () => {
      ;(manager.listAgents as ReturnType<typeof vi.fn>).mockReturnValue([
        record({ id: "a1", status: "running", completedAt: undefined }),
        record({ id: "a2", status: "stopped" }),
        record({ id: "a3", status: "stopped" }),
      ])
      ;(manager.isSettling as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => id !== "a3",
      )
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:list:reply:req-l2", reply)
      events.emit("subagents:rpc:list", { requestId: "req-l2" })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      const agents = reply.mock.calls[0][0].data.agents
      expect(agents.map((a: any) => [a.id, a.settling])).toEqual([
        ["a1", undefined],
        ["a2", true],
        ["a3", undefined],
      ])
      expect(agents[2]).not.toHaveProperty("settling")
    })

    it("unsub stops responding to get and list", async () => {
      const { unsubGet, unsubList } = registerRpcHandlers(deps)
      unsubGet()
      unsubList()

      const reply = vi.fn()
      events.on("subagents:rpc:get:reply:req-g4", reply)
      events.on("subagents:rpc:list:reply:req-l2", reply)
      events.emit("subagents:rpc:get", {
        requestId: "req-g4",
        agentId: "agent-42",
      })
      events.emit("subagents:rpc:list", { requestId: "req-l2" })

      await new Promise((r) => setTimeout(r, 20))
      expect(reply).not.toHaveBeenCalled()
    })
  })

  // --- concurrent requests ---

  describe("concurrent requests", () => {
    it("handles multiple simultaneous spawn requests independently", async () => {
      let callCount = 0
      ;(manager.spawn as ReturnType<typeof vi.fn>).mockImplementation(
        () => `agent-${++callCount}`,
      )
      registerRpcHandlers(deps)

      const reply1 = vi.fn()
      const reply2 = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-a", reply1)
      events.on("subagents:rpc:spawn:reply:req-b", reply2)

      events.emit("subagents:rpc:spawn", {
        requestId: "req-a",
        type: "Explore",
        prompt: "first",
      })
      events.emit("subagents:rpc:spawn", {
        requestId: "req-b",
        type: "Plan",
        prompt: "second",
      })

      await vi.waitFor(() => {
        expect(reply1).toHaveBeenCalled()
        expect(reply2).toHaveBeenCalled()
      })

      expect(reply1).toHaveBeenCalledWith({
        success: true,
        data: { id: "agent-1" },
      })
      expect(reply2).toHaveBeenCalledWith({
        success: true,
        data: { id: "agent-2" },
      })
    })
  })

  // --- model override resolution (regression for cross-extension callers
  //     that forward a serializable string instead of a Model object) ---

  describe("spawn RPC model override", () => {
    const fakeModel = {
      id: "gpt-5.5",
      provider: "openai-codex",
      name: "GPT 5.5",
    }
    const registry = {
      find: (provider: string, id: string) =>
        provider === fakeModel.provider && id === fakeModel.id
          ? fakeModel
          : null,
      getAll: () => [fakeModel],
      getAvailable: () => [fakeModel],
    }

    beforeEach(() => {
      ctx = { session: true, modelRegistry: registry }
      deps = { events, pi: { events }, getCtx: () => ctx, manager }
    })

    it("resolves a string model to a Model instance before manager.spawn", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-m1", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-m1",
        type: "general-purpose",
        prompt: "x",
        options: { model: "openai-codex/gpt-5.5" },
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: true,
        data: { id: "agent-42" },
      })
      expect(manager.spawn).toHaveBeenCalledWith(
        deps.pi,
        ctx,
        "general-purpose",
        "x",
        { model: fakeModel },
      )
    })

    it("passes a Model object through unchanged", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-m2", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-m2",
        type: "general-purpose",
        prompt: "x",
        options: { model: fakeModel },
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(manager.spawn).toHaveBeenCalledWith(
        deps.pi,
        ctx,
        "general-purpose",
        "x",
        { model: fakeModel },
      )
    })

    it("surfaces a clear error when the model string can't be resolved", async () => {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-m3", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-m3",
        type: "general-purpose",
        prompt: "x",
        options: { model: "nope/does-not-exist" },
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      const call = (reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.success).toBe(false)
      expect(call.error).toMatch(/Model not found/)
      expect(manager.spawn).not.toHaveBeenCalled()
    })

    it("treats an explicit null model as no override at all", async () => {
      // A JSON-forwarding caller can serialize an unset field as null. The
      // runner reads `options.model ?? default`, so null means "inherit" —
      // it must not be resolved, scope-checked, or dereferenced.
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-m5", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-m5",
        type: "general-purpose",
        prompt: "x",
        options: { model: null },
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      expect(reply).toHaveBeenCalledWith({
        success: true,
        data: { id: "agent-42" },
      })
      expect(manager.spawn).toHaveBeenCalledWith(
        deps.pi,
        ctx,
        "general-purpose",
        "x",
        { model: null },
      )
    })

    it("errors when ctx has no modelRegistry but a string model is given", async () => {
      ctx = { session: true } // no modelRegistry
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on("subagents:rpc:spawn:reply:req-m4", reply)
      events.emit("subagents:rpc:spawn", {
        requestId: "req-m4",
        type: "general-purpose",
        prompt: "x",
        options: { model: "openai-codex/gpt-5.5" },
      })

      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      const call = (reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.success).toBe(false)
      expect(call.error).toMatch(/modelRegistry is unavailable/)
      expect(manager.spawn).not.toHaveBeenCalled()
    })
  })
  // --- scopeModels on the RPC spawn path (#240): an override on the RPC
  //     payload is an orchestrator-level choice, so it gets the Agent tool's
  //     hard error rather than reaching the spawn on an out-of-scope model. ---

  describe("spawn RPC model scope", () => {
    const ALLOWED = { id: "gpt-5.5", provider: "openai-codex", name: "GPT 5.5" }
    const BLOCKED = {
      id: "claude-sonnet-4",
      provider: "anthropic",
      name: "Claude Sonnet 4",
    }
    const MODELS = [ALLOWED, BLOCKED]
    const registry = {
      find: (provider: string, id: string) =>
        MODELS.find((m) => m.provider === provider && m.id === id) ?? null,
      getAll: () => MODELS,
      getAvailable: () => MODELS,
    }

    let projectDir: string
    let agentDir: string
    let prevAgentDir: string | undefined
    let prevEnabled: boolean

    beforeEach(() => {
      // resolveEnabledModels memoizes on (patterns, mtime+size of both settings
      // files) — a fresh project dir per test keeps one case's allowlist from
      // being served to the next. Same harness as test/model-scope.test.ts.
      projectDir = mkdtempSync(join(tmpdir(), "pi-rpc-scope-project-"))
      agentDir = mkdtempSync(join(tmpdir(), "pi-rpc-scope-global-"))
      prevAgentDir = process.env.PI_CODING_AGENT_DIR
      process.env.PI_CODING_AGENT_DIR = agentDir
      prevEnabled = isScopeModelsEnabled()
      mkdirSync(join(projectDir, ".pi"), { recursive: true })
      writeFileSync(
        join(projectDir, ".pi", "settings.json"),
        JSON.stringify({ enabledModels: ["openai-codex/gpt-5.5"] }),
      )
      setScopeModelsEnabled(true)
      ctx = { session: true, cwd: projectDir, modelRegistry: registry }
      deps = { events, pi: { events }, getCtx: () => ctx, manager }
    })

    afterEach(() => {
      setScopeModelsEnabled(prevEnabled) // module-global — restore for other suites
      if (prevAgentDir == null) delete process.env.PI_CODING_AGENT_DIR
      else process.env.PI_CODING_AGENT_DIR = prevAgentDir
      rmSync(projectDir, { recursive: true, force: true })
      rmSync(agentDir, { recursive: true, force: true })
    })

    async function spawn(requestId: string, model: unknown) {
      registerRpcHandlers(deps)
      const reply = vi.fn()
      events.on(`subagents:rpc:spawn:reply:${requestId}`, reply)
      events.emit("subagents:rpc:spawn", {
        requestId,
        type: "general-purpose",
        prompt: "x",
        options: { model },
      })
      await vi.waitFor(() => expect(reply).toHaveBeenCalled())
      return (reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    }

    it("refuses an out-of-scope string override, listing what is allowed", async () => {
      // The reported case: a bare "sonnet" fuzzy-resolves across providers, so
      // only the RESOLVED model can be compared against enabledModels.
      const call = await spawn("req-sc1", "sonnet")
      expect(call.success).toBe(false)
      expect(call.error).toMatch(/Model not in scope/)
      expect(call.error).toContain('"sonnet"')
      expect(call.error).toContain("  openai-codex/gpt-5.5")
      expect(manager.spawn).not.toHaveBeenCalled()
    })

    it("refuses an out-of-scope Model object override too", async () => {
      const call = await spawn("req-sc2", BLOCKED)
      expect(call.success).toBe(false)
      expect(call.error).toMatch(/Model not in scope/)
      expect(call.error).toContain('"anthropic/claude-sonnet-4"')
      expect(manager.spawn).not.toHaveBeenCalled()
    })

    it("spawns normally when the override is in scope", async () => {
      const call = await spawn("req-sc3", "openai-codex/gpt-5.5")
      expect(call).toEqual({ success: true, data: { id: "agent-42" } })
      expect(manager.spawn).toHaveBeenCalledWith(
        deps.pi,
        ctx,
        "general-purpose",
        "x",
        { model: ALLOWED },
      )
    })

    it("does not check scope while the setting is off", async () => {
      setScopeModelsEnabled(false)
      const call = await spawn("req-sc4", "sonnet")
      expect(call).toEqual({ success: true, data: { id: "agent-42" } })
      expect(manager.spawn).toHaveBeenCalledWith(
        deps.pi,
        ctx,
        "general-purpose",
        "x",
        { model: BLOCKED },
      )
    })
  })
})

describe("register-agents RPC", () => {
  let events: EventBus
  let deps: RpcDeps

  beforeEach(() => {
    events = createEventBus()
    deps = {
      events,
      pi: { events },
      getCtx: () => ({}),
      manager: identityManagerStub(),
      workflows: identityWorkflowsStub(),
    }
  })

  afterEach(() => {
    clearEphemeralAgents()
    registerAgents(new Map())
  })

  const register = (requestId: string, agents: unknown[], tools?: string) =>
    new Promise((resolve) => {
      events.on(`subagents:rpc:register-agents:reply:${requestId}`, resolve)
      events.emit("subagents:rpc:register-agents", {
        requestId,
        agents,
        ...(tools ? { tools } : {}),
      })
    })

  it("registers an ephemeral type from a persona payload", async () => {
    registerRpcHandlers(deps)
    const reply = await register("reg-1", [
      {
        name: "MCP Builder",
        description: "Expert MCP developer.",
        systemPrompt: "You are MCP Builder.",
        color: "indigo",
      },
    ])
    expect(reply).toEqual({
      success: true,
      data: { agents: ["MCP Builder"] },
    })
    const config = getAgentConfig("MCP Builder")
    expect(config?.systemPrompt).toBe("You are MCP Builder.")
    expect(config?.color).toBe("indigo")
    expect(config?.promptMode).toBe("replace")
    expect(config?.extensions).toBe(false)
  })

  it('maps tools "none" to a fully tool-less type and rejects anything else', async () => {
    registerRpcHandlers(deps)
    await register(
      "reg-2",
      [{ name: "S", description: "d", systemPrompt: "p" }],
      "none",
    )
    expect(getAgentConfig("S")?.builtinToolNames).toEqual([])

    const rejected = await register(
      "reg-3",
      [{ name: "T", description: "d", systemPrompt: "p" }],
      "everything",
    )
    expect(rejected).toEqual({
      success: false,
      error: 'tools must be "none" or "builtin"',
    })
  })

  it("rejects an invalid payload with an error envelope", async () => {
    registerRpcHandlers(deps)
    const reply = await register("reg-4", [{ description: "no name" }])
    expect(reply).toEqual({
      success: false,
      error: "agents[0].name must be 1-64 characters",
    })
    expect(getAgentConfig("MCP Builder")).toBeUndefined()
  })

  it("fails when a name collides with an existing type", async () => {
    registerRpcHandlers(deps)
    const reply = await register("reg-col", [
      { name: "Explore", description: "d", systemPrompt: "p" },
    ])
    expect(reply).toEqual({
      success: false,
      error: 'agent type already exists: "Explore"',
    })

    await clearEphemeralAgents()
    await register("reg-pre", [
      { name: "Earlier Type", description: "d", systemPrompt: "p" },
    ])
    const mixed = await register("reg-col2", [
      { name: "Good Agent", description: "d", systemPrompt: "p" },
      { name: "Explore", description: "d", systemPrompt: "p" },
    ])
    expect(mixed).toEqual({
      success: false,
      error: 'agent type already exists: "Explore"',
    })
    expect(getAgentConfig("Good Agent")).toBeUndefined()

    const scoped = await register("reg-col3", [
      { name: "Earlier Type", description: "d", systemPrompt: "p2" },
    ])
    expect(scoped).toEqual({
      success: true,
      data: { agents: ["Earlier Type"] },
    })
  })

  it("fails on duplicate names within one payload", async () => {
    registerRpcHandlers(deps)
    const reply = await register("reg-dup", [
      { name: "MCP Builder", description: "d", systemPrompt: "p" },
      { name: "mcp builder", description: "d", systemPrompt: "p2" },
    ])
    expect(reply).toEqual({
      success: false,
      error: 'agents[1].name "mcp builder" duplicates agents[0]',
    })
    expect(getAgentConfig("MCP Builder")).toBeUndefined()
  })

  it("leaves prior ephemeral values when a mixed update + conflict fails", async () => {
    registerRpcHandlers(deps)
    await register("reg-pre", [
      { name: "Earlier Type", description: "d", systemPrompt: "first" },
    ])
    const mixed = await register("reg-mix", [
      { name: "Earlier Type", description: "d", systemPrompt: "second" },
      { name: "Explore", description: "d", systemPrompt: "p" },
    ])
    expect(mixed).toMatchObject({
      success: false,
      error: 'agent type already exists: "Explore"',
    })
    expect(getAgentConfig("Earlier Type")?.systemPrompt).toBe("first")
  })

  it("emits agents-changed only after a fully successful batch", async () => {
    const emitted: Array<{ event: string }> = []
    const bus = {
      handlers: new Map<string, Set<(data: unknown) => void>>(),
      on(event: string, handler: (data: unknown) => void) {
        const set = this.handlers.get(event) ?? new Set()
        set.add(handler)
        this.handlers.set(event, set)
        return () => set.delete(handler)
      },
      emit(event: string, data: unknown) {
        emitted.push({ event })
        for (const h of this.handlers.get(event) ?? []) h(data)
      },
    } as EventBus
    registerRpcHandlers({
      events: bus,
      pi: { events: bus },
      getCtx: () => ({}),
      manager: identityManagerStub(),
      workflows: identityWorkflowsStub(),
    })
    const fail = await new Promise((resolve) => {
      bus.on("subagents:rpc:register-agents:reply:reg-atomic-fail", resolve)
      bus.emit("subagents:rpc:register-agents", {
        requestId: "reg-atomic-fail",
        agents: [
          { name: "Seat Me", description: "d", systemPrompt: "p" },
          { name: "Explore", description: "d", systemPrompt: "p" },
        ],
      })
    })
    expect(fail).toMatchObject({ success: false })
    expect(
      emitted.filter((e) => e.event === "subagents:agents-changed").length,
    ).toBe(0)

    await new Promise((resolve) => {
      bus.on("subagents:rpc:register-agents:reply:reg-atomic-ok", resolve)
      bus.emit("subagents:rpc:register-agents", {
        requestId: "reg-atomic-ok",
        agents: [{ name: "Seat Me", description: "d", systemPrompt: "p" }],
      })
    })
    expect(
      emitted.filter((e) => e.event === "subagents:agents-changed").length,
    ).toBe(1)
  })

  it("unregisters over the bus and leaves file-backed types alone", async () => {
    registerRpcHandlers(deps)
    registerAgents(
      new Map([
        [
          "Reality Checker",
          {
            name: "Reality Checker",
            description: "file",
            systemPrompt: "p",
            promptMode: "replace",
            extensions: false,
            skills: false,
          },
        ],
      ]),
    )
    await register("reg-5", [
      { name: "MCP Builder", description: "d", systemPrompt: "p" },
    ])

    const reply = new Promise((resolve) => {
      events.on("subagents:rpc:unregister-agents:reply:unreg-1", resolve)
      events.emit("subagents:rpc:unregister-agents", {
        requestId: "unreg-1",
        names: ["MCP Builder", "Reality Checker"],
      })
    })
    expect(await reply).toEqual({ success: true })
    expect(getAgentConfig("MCP Builder")).toBeUndefined()
    expect(getAgentConfig("Reality Checker")).toBeDefined()
  })
})

describe("list-agents RPC", () => {
  let events: EventBus
  let emitted: Array<{ event: string; data: unknown }>
  let refreshAgents: ReturnType<typeof vi.fn>
  let deps: RpcDeps

  beforeEach(() => {
    emitted = []
    const handlers = new Map<string, Set<(data: unknown) => void>>()
    events = {
      on(event, handler) {
        if (!handlers.has(event)) handlers.set(event, new Set())
        handlers.get(event)!.add(handler)
        return () => handlers.get(event)?.delete(handler)
      },
      emit(event, data) {
        emitted.push({ event, data })
        for (const handler of handlers.get(event) ?? []) handler(data)
      },
    }
    refreshAgents = vi.fn()
    deps = {
      events,
      pi: { events },
      getCtx: () => ({}),
      refreshAgents,
      manager: identityManagerStub(),
      workflows: identityWorkflowsStub(),
    }
  })

  afterEach(() => {
    clearEphemeralAgents()
    registerAgents(new Map())
  })

  const list = (requestId: string) =>
    new Promise((resolve) => {
      events.on(`subagents:rpc:list-agents:reply:${requestId}`, resolve)
      events.emit("subagents:rpc:list-agents", { requestId })
    })

  it("lists enabled agents with their display names and colors", async () => {
    registerAgents(
      new Map([
        [
          "Code Reviewer",
          {
            name: "Code Reviewer",
            displayName: "Code Reviewer",
            description: "Reviews code",
            color: "purple",
            systemPrompt: "p",
            promptMode: "replace",
            extensions: false,
            skills: false,
          },
        ],
      ]),
    )
    registerRpcHandlers(deps)
    const reply = (await list("list-1")) as {
      success: boolean
      data: {
        agents: Array<{ name: string; displayName?: string; color?: string }>
      }
    }
    expect(reply.success).toBe(true)
    const reviewer = reply.data.agents.find((a) => a.name === "Code Reviewer")
    expect(reviewer).toEqual({
      name: "Code Reviewer",
      displayName: "Code Reviewer",
      color: "purple",
    })
    expect(refreshAgents).toHaveBeenCalled()
  })

  it("includes a freshly registered ephemeral type", async () => {
    registerRpcHandlers(deps)
    events.emit("subagents:rpc:register-agents", {
      requestId: "reg-1",
      agents: [
        {
          name: "MCP Builder",
          description: "d",
          systemPrompt: "p",
          color: "indigo",
        },
      ],
    })
    await new Promise((r) => setTimeout(r, 10))
    const reply = (await list("list-2")) as {
      success: boolean
      data: { agents: Array<{ name: string; color?: string }> }
    }
    const builder = reply.data.agents.find((a) => a.name === "MCP Builder")
    expect(builder).toEqual({
      name: "MCP Builder",
      displayName: "MCP Builder",
      color: "indigo",
    })
  })

  it("announces registry changes once per real mutation", async () => {
    registerRpcHandlers(deps)
    const changes = () =>
      emitted.filter(({ event }) => event === "subagents:agents-changed").length
    const settle = () => new Promise((r) => setTimeout(r, 10))

    events.emit("subagents:rpc:register-agents", {
      requestId: "reg-col",
      agents: [{ name: "Explore", description: "d", systemPrompt: "p" }],
    })
    await settle()
    expect(changes()).toBe(0)

    events.emit("subagents:rpc:register-agents", {
      requestId: "reg-2",
      agents: [{ name: "UI Designer", description: "d", systemPrompt: "p" }],
    })
    await settle()
    expect(changes()).toBe(1)

    events.emit("subagents:rpc:unregister-agents", {
      requestId: "unreg-nop",
      names: ["Never Registered"],
    })
    await settle()
    expect(changes()).toBe(1)

    events.emit("subagents:rpc:unregister-agents", {
      requestId: "unreg-1",
      names: ["UI Designer"],
    })
    await settle()
    expect(changes()).toBe(2)
  })

  it("list-agents is not the running-agent list RPC", async () => {
    registerRpcHandlers(deps)
    const runs = await new Promise((resolve) => {
      events.on("subagents:rpc:list:reply:runs-1", resolve)
      events.emit("subagents:rpc:list", { requestId: "runs-1" })
    })
    const types = await list("types-1")
    expect(runs).toEqual({ success: true, data: { agents: [] } })
    expect(types).toMatchObject({
      success: true,
      data: { agents: expect.any(Array) },
    })
    expect(
      ((types as { data: { agents: unknown[] } }).data.agents.length ?? 0) > 0,
    ).toBe(true)
  })
})
