import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"

const [mode, entry, relayUrl, root] = process.argv.slice(2)
assert.ok(mode === "cancel" || mode === "lifecycle")
assert.ok(entry)
assert.ok(root)

const cwd = join(root, "work")
mkdirSync(cwd, { recursive: true })
process.env.HOME = root
process.env.REMOTE_PI_HOME = root
process.env.REMOTE_PI_RELAY = relayUrl
process.env.REMOTE_PI_ALLOW_FILE_IDENTITY = "1"
delete process.env.REMOTE_PI_DAEMON

const entryUrl = pathToFileURL(entry)
const remotePi = await import(entryUrl)
const storage = await import(new URL("./pairing/storage.js", entryUrl))
const globalConfig = await import(
  new URL("./session/global_config.js", entryUrl)
)
const cwdLock = await import(new URL("./session/cwd_lock.js", entryUrl))
const leaderElection = await import(
  new URL("./session/leader_election.js", entryUrl)
)
const { SessionPeer } = await import(new URL("./session/peer.js", entryUrl))
const { registerAgentTools } = await import(
  new URL("./session/tools.js", entryUrl)
)
const getState = remotePi["_getState"]
const hasMeshNode = remotePi["_hasMeshNodeForTest"]
const setNativeBindingError = storage["_setNativeBindingErrorForTest"]
const setKeyringExpected = storage["_setKeyringExpectedForTest"]
const setKeyringRetry = storage["_setKeyringRetryForTest"]

setNativeBindingError(new Error("aggregate smoke: no native keyring"))
setKeyringExpected(false)
setKeyringRetry(1, 0)

const handlers = new Map()
const commands = new Map()
const tools = new Map()
const sentMessages = []
const sentUserMessages = []
const notifications = []
const eventBusHandlers = new Map()
const eventBus = {
  on(name, handler) {
    const listeners = eventBusHandlers.get(name) ?? new Set()
    listeners.add(handler)
    eventBusHandlers.set(name, listeners)
    return () => listeners.delete(handler)
  },
  emit(name, value) {
    for (const handler of eventBusHandlers.get(name) ?? []) handler(value)
  },
}
const pi = {
  events: eventBus,
  on(name, handler) {
    const listeners = handlers.get(name) ?? []
    listeners.push(handler)
    handlers.set(name, listeners)
  },
  registerCommand(name, command) {
    commands.set(name, command)
  },
  registerTool(tool) {
    tools.set(tool.name, tool)
  },
  registerMessageRenderer() {},
  sendMessage(message) {
    sentMessages.push(message)
  },
  sendUserMessage(...args) {
    sentUserMessages.push(args)
  },
  getThinkingLevel() {
    return "off"
  },
  getCommands() {
    return [...commands.keys()].map((name) => ({ name }))
  },
}

await remotePi.default(pi)
assert.ok(commands.has("remote-pi"))
assert.deepEqual([...tools.keys()].toSorted(), [
  "agent_request",
  "agent_send",
  "list_peers",
])

async function emit(name, event = {}, ctx) {
  await Promise.all(
    (handlers.get(name) ?? []).map((handler) => handler(event, ctx)),
  )
}

async function waitForRelaySockets(expected, attempts = 40) {
  const state = await fetch(`${relayUrl}/state`).then((response) =>
    response.json(),
  )
  if (state.openSockets === expected) return
  if (attempts <= 1) assert.fail(`relay did not reach ${expected} open sockets`)
  await new Promise((resolve) => setTimeout(resolve, 25))
  return waitForRelaySockets(expected, attempts - 1)
}

function assertNoServiceArtifacts() {
  for (const path of [
    join(root, ".config", "systemd", "user", "remote-pi-supervisord.service"),
    join(root, "Library", "LaunchAgents", "dev.remotepi.supervisord.plist"),
    join(root, ".pi", "remote", "RemotePiSupervisor.xml"),
    join(root, ".pi", "remote", "RemotePiSupervisorLauncher.vbs"),
  ]) {
    assert.equal(existsSync(path), false)
  }
}

function ui(selectAnswers = []) {
  return {
    notify(message, level) {
      notifications.push({ message, level })
    },
    setStatus() {},
    setTitle() {},
    input: async () => (mode === "cancel" ? undefined : "smoke-agent"),
    select: async () => selectAnswers.shift(),
  }
}
const ctx = {
  cwd,
  ui: ui(mode === "lifecycle" ? ["Yes", "Yes"] : []),
  getModel: () => undefined,
}

try {
  await emit("session_start", {}, ctx)
  assert.equal(getState(), "idle")
  assert.equal(hasMeshNode(), false)
  assert.equal(
    existsSync(globalConfig.sessionSockPath(globalConfig.LOCAL_SESSION_NAME)),
    false,
  )
  assertNoServiceArtifacts()
  await waitForRelaySockets(0)

  if (mode === "cancel") {
    await commands.get("remote-pi setup").handler("", ctx)
    assert.equal(
      existsSync(join(cwd, ".pi", "remote-pi", "config.json")),
      false,
    )
    await commands.get("remote-pi").handler("", ctx)
    assert.equal(getState(), "idle")
    assert.equal(hasMeshNode(), false)
    assert.equal(
      existsSync(join(cwd, ".pi", "remote-pi", "config.json")),
      false,
    )
    const held = await cwdLock.acquireCwdLock(cwd, "work")
    assert.equal(held.ok, false)
    await emit("session_shutdown", {}, ctx)
    const released = await cwdLock.acquireCwdLock(cwd, "work")
    assert.equal(released.ok, true)
    released.release()
    assert.ok(
      notifications.some(({ message }) => message.includes("Setup cancelled")),
    )
  } else {
    await commands.get("remote-pi").handler("", ctx)
    await waitForRelaySockets(1)
    assert.equal(getState(), "started")
    assert.equal(hasMeshNode(), true)
    const configPath = join(cwd, ".pi", "remote-pi", "config.json")
    assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), {
      agent_name: "smoke-agent",
      auto_start_relay: true,
    })

    const identityPath = join(root, ".pi", "remote", "identity.json")
    assert.equal(statSync(dirname(identityPath)).mode & 0o777, 0o700)
    assert.equal(statSync(identityPath).mode & 0o777, 0o600)
    const identity = JSON.parse(readFileSync(identityPath, "utf8"))
    assert.ok(identity.pk && identity.sk)
    const sockPath = globalConfig.sessionSockPath(
      globalConfig.LOCAL_SESSION_NAME,
    )
    assert.equal(
      existsSync(sockPath),
      true,
      JSON.stringify({
        sockPath,
        sessionsDir: globalConfig.sessionsDir(),
        entries: readdirSync(dirname(sockPath), { withFileTypes: true }).map(
          (dirEntry) => ({
            name: dirEntry.name,
            socket: dirEntry.isSocket(),
          }),
        ),
        probe: await remotePi.probeListPeers(sockPath, 100),
      }),
    )
    assert.equal(lstatSync(sockPath).isSocket(), true)
    assert.equal(statSync(sockPath).mode & 0o002, 0)

    await commands.get("remote-pi pair").handler("--ttl 10", ctx)
    const pairMessage = sentMessages.find(
      (message) => message.customType === "remote-pi:pair-code",
    )
    assert.ok(pairMessage?.details?.token)
    assert.ok(pairMessage.details.expiresAt > Date.now())
    assert.ok(pairMessage.details.expiresAt <= Date.now() + 11_000)
    assert.equal(
      JSON.stringify([sentMessages, sentUserMessages]).includes(identity.sk),
      false,
    )
    const [selfAddress] = await remotePi.probeListPeers(sockPath, 100)
    assert.ok(selfAddress)
    const selfResult = await tools.get("agent_send").execute("send-self", {
      to: selfAddress,
      body: "no-op",
    })
    assert.equal(selfResult.details.status, "refused")

    const secondPeer = new SessionPeer({ sockPath, name: "peer", cwd })
    await secondPeer.start()
    secondPeer.onMessage((message) => {
      if (message.body?.kind === "request") {
        void secondPeer.send(message.from, { ok: true }, message.id)
      }
    })
    const secondAddress = secondPeer.address()
    const livePeers = await tools.get("list_peers").execute("list-live", {})
    assert.deepEqual(livePeers.details.peers, [secondAddress])
    const delivered = await tools.get("agent_send").execute("send-live", {
      to: secondAddress,
      body: { secret: "audit-body-marker" },
    })
    assert.equal(delivered.details.status, "received")
    const replied = await tools.get("agent_request").execute("request-live", {
      to: secondAddress,
      body: { kind: "request" },
      timeout_ms: 1_000,
    })
    assert.deepEqual(replied.details, { ok: true })
    await new Promise((resolve) => setTimeout(resolve, 20))
    const auditPath = globalConfig.sessionAuditPath(
      globalConfig.LOCAL_SESSION_NAME,
    )
    assert.equal(
      readFileSync(auditPath, "utf8").includes("audit-body-marker"),
      false,
    )
    await secondPeer.leave()

    const protocolSock = join(root, "protocol.sock")
    const protocolPeer = new SessionPeer({
      sockPath: protocolSock,
      name: "protocol-sender",
      cwd,
    })
    const protocolTarget = new SessionPeer({
      sockPath: protocolSock,
      name: "protocol-target",
      cwd,
    })
    try {
      await protocolPeer.start()
      await protocolTarget.start()
      const protocolBroker = protocolPeer.localBroker()
      assert.ok(protocolBroker)
      protocolTarget.onMessage((message) => {
        if (message.body?.kind === "malformed") {
          protocolBroker.peers
            .get(message.from)
            ?.socket.write("{malformed-json}\n")
        }
      })
      protocolBroker.setRemoteRouter({
        listRemotePeers: () => [],
        listRemotePeerInfos: () => [],
        tryRouteOutbound(message) {
          if (!message.to.startsWith("remote:")) return false
          const reason =
            message.to === "remote:denied" ? "not_authorized" : "offline"
          setTimeout(() => {
            protocolBroker.injectFromRemote({
              from: "broker",
              to: message.from,
              id: randomUUID(),
              re: message.id,
              body: { type: "transport_error", reason },
            })
          }, 0)
          return true
        },
      })
      const protocolTools = new Map()
      registerAgentTools(
        { registerTool: (tool) => protocolTools.set(tool.name, tool) },
        () => protocolPeer,
      )
      const denied = await protocolTools
        .get("agent_send")
        .execute("send-denied", {
          to: "remote:denied",
          body: {},
        })
      assert.equal(denied.details.reason, "not_authorized")
      assert.equal(denied.details.status, "denied")
      const timeout = await protocolTools
        .get("agent_send")
        .execute("send-timeout", {
          to: "remote:offline",
          body: {},
        })
      assert.equal(timeout.details.reason, "offline")
      assert.equal(timeout.details.status, "timeout")
      const malformed = await protocolTools
        .get("agent_request")
        .execute("request-malformed", {
          to: protocolTarget.address(),
          body: { kind: "malformed" },
          timeout_ms: 30,
        })
      assert.match(malformed.content[0].text, /timed out/)
    } finally {
      await protocolTarget.leave()
      await protocolPeer.leave()
    }

    const regularPath = join(dirname(sockPath), "not-a-socket")
    writeFileSync(regularPath, "keep")
    leaderElection.removeStaleSock(regularPath)
    assert.equal(readFileSync(regularPath, "utf8"), "keep")
    const targetPath = join(dirname(sockPath), "target")
    const symlinkPath = join(dirname(sockPath), "socket-link")
    writeFileSync(targetPath, "keep")
    symlinkSync(targetPath, symlinkPath)
    leaderElection.removeStaleSock(symlinkPath)
    assert.equal(lstatSync(symlinkPath).isSymbolicLink(), true)

    await commands.get("remote-pi stop").handler("", ctx)
    await waitForRelaySockets(0)
    assert.equal(getState(), "idle")
    assert.equal(hasMeshNode(), false)
    assert.equal(existsSync(sockPath), false)

    await commands.get("remote-pi").handler("", ctx)
    await waitForRelaySockets(1)
    assert.equal(getState(), "started")
    assert.equal(hasMeshNode(), true)
    await emit("session_shutdown", {}, ctx)
    await waitForRelaySockets(0)
    assert.equal(getState(), "idle")
    assert.equal(hasMeshNode(), false)
    assert.equal(existsSync(sockPath), false)
    assertNoServiceArtifacts()
  }
} finally {
  try {
    await emit("session_shutdown", {}, ctx)
  } catch {}
}
