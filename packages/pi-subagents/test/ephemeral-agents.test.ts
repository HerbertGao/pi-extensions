import { afterEach, describe, expect, it } from "vitest"
import {
  clearEphemeralAgents,
  getAgentConfig,
  registerAgents,
  registerEphemeralAgents,
  unregisterEphemeralAgents,
} from "../src/agent-types.js"
import type { AgentConfig } from "../src/types.js"

const seat = (over: Partial<AgentConfig> = {}): AgentConfig => ({
  name: "MCP Builder",
  description: "Seats a catalog persona.",
  systemPrompt: "You are MCP Builder.",
  promptMode: "replace",
  extensions: false,
  skills: false,
  ...over,
})

afterEach(() => {
  clearEphemeralAgents()
  registerAgents(new Map())
})

describe("ephemeral agent registry", () => {
  it("registers a type that survives a file reload", () => {
    const names = registerEphemeralAgents(new Map([["MCP Builder", seat()]]))
    expect(names).toEqual(["MCP Builder"])
    expect(getAgentConfig("MCP Builder")?.systemPrompt).toBe(
      "You are MCP Builder.",
    )

    // reloadCustomAgents() lands here before every spawn; the overlay must hold.
    registerAgents(new Map())
    expect(getAgentConfig("MCP Builder")?.description).toBe(
      "Seats a catalog persona.",
    )
  })

  it("never shadows a file-loaded agent with the same name", () => {
    registerAgents(
      new Map([
        ["MCP Builder", seat({ description: "the user's own file agent" })],
      ]),
    )
    registerEphemeralAgents(new Map([["MCP Builder", seat()]]))

    expect(getAgentConfig("MCP Builder")?.description).toBe(
      "the user's own file agent",
    )
    // …including case-insensitively.
    registerAgents(
      new Map([["mcp builder", seat({ description: "lowercase file agent" })]]),
    )
    expect(getAgentConfig("MCP Builder")?.description).toBe(
      "lowercase file agent",
    )
  })

  it("unregisters its own types and leaves file-backed ones alone", () => {
    registerAgents(
      new Map([["Reality Checker", seat({ name: "Reality Checker" })]]),
    )
    registerEphemeralAgents(new Map([["MCP Builder", seat()]]))
    unregisterEphemeralAgents(["mcp builder", "Reality Checker"])

    expect(getAgentConfig("MCP Builder")).toBeUndefined()
    expect(getAgentConfig("Reality Checker")).toBeDefined()
    // A later reload does not resurrect the unregistered type.
    registerAgents(new Map())
    expect(getAgentConfig("MCP Builder")).toBeUndefined()
  })

  it("clears every ephemeral type on session start", () => {
    registerEphemeralAgents(
      new Map([
        ["MCP Builder", seat()],
        ["UI Designer", seat({ name: "UI Designer" })],
      ]),
    )
    clearEphemeralAgents()
    registerAgents(new Map())

    expect(getAgentConfig("MCP Builder")).toBeUndefined()
    expect(getAgentConfig("UI Designer")).toBeUndefined()
  })
})

describe("ephemeral agent collisions and re-registration", () => {
  afterEach(() => {
    clearEphemeralAgents()
    registerAgents(new Map())
  })

  it("reports a name colliding with a default type as skipped, never applied", () => {
    const applied = registerEphemeralAgents(
      new Map([["Explore", seat({ name: "Explore" })]]),
    )
    expect(applied).toEqual([])
    // The default Explore stays itself; the persona never runs under its name.
    expect(getAgentConfig("Explore")?.description).not.toBe(
      "Seats a catalog persona.",
    )
  })

  it("drops a rejected collision from the store, so it cannot resurrect", () => {
    registerAgents(
      new Map([
        [
          "Custom Seat",
          seat({ name: "Custom Seat", description: "the user's file agent" }),
        ],
      ]),
    )
    // The registration is refused…
    const applied = registerEphemeralAgents(
      new Map([["Custom Seat", seat({ name: "Custom Seat" })]]),
    )
    expect(applied).toEqual([])
    // …and stays refused after the file agent disappears and a reload runs.
    registerAgents(new Map())
    expect(getAgentConfig("Custom Seat")).toBeUndefined()
  })

  it("replaces a previous registration immediately, without a reload", () => {
    registerEphemeralAgents(new Map([["MCP Builder", seat()]]))
    registerEphemeralAgents(
      new Map([["MCP Builder", seat({ systemPrompt: "Updated." })]]),
    )
    expect(getAgentConfig("MCP Builder")?.systemPrompt).toBe("Updated.")

    // A case-variant re-registration replaces in place and leaves no zombie.
    registerEphemeralAgents(
      new Map([["mcp builder", seat({ systemPrompt: "Again." })]]),
    )
    expect(getAgentConfig("MCP Builder")?.systemPrompt).toBe("Again.")
    unregisterEphemeralAgents(["MCP Builder"])
    registerAgents(new Map())
    expect(getAgentConfig("MCP Builder")).toBeUndefined()
    expect(getAgentConfig("mcp builder")).toBeUndefined()
  })
})
