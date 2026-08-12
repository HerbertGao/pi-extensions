import assert from "node:assert/strict"
import { createPublicKey, randomBytes, verify } from "node:crypto"
import { rm } from "node:fs/promises"
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { WebSocketServer } from "ws"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const childPath = join(root, "scripts", "remote-pi-real-smoke-child.mjs")

async function runChild(mode, entry, relayUrl) {
  const childRoot = join(
    process.platform === "win32" ? (process.env.TEMP ?? process.cwd()) : "/tmp",
    `rp-${mode}-${randomBytes(8).toString("hex")}`,
  )
  try {
    return await new Promise((resolvePromise, reject) => {
      const child = spawn(
        process.execPath,
        [childPath, mode, entry, relayUrl, childRoot],
        { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
      )
      let stdout = ""
      let stderr = ""
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        child.kill("SIGKILL")
      }, 30_000)
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk
      })
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk
      })
      child.once("error", (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.once("close", (code, signal) => {
        clearTimeout(timer)
        if (timedOut) {
          reject(
            new Error(
              `remote-pi ${mode} smoke timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`,
            ),
          )
        } else if (code !== 0) {
          reject(
            new Error(
              `remote-pi ${mode} smoke exited ${code ?? signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
            ),
          )
        } else {
          resolvePromise({ stdout, stderr })
        }
      })
    })
  } finally {
    await rm(childRoot, { recursive: true, force: true })
  }
}

export async function runRemotePiRealSmoke({ remotePiEntry }) {
  assert.ok(remotePiEntry, "remotePiEntry is required")

  let connections = 0
  let closes = 0
  let hellos = 0
  let authentications = 0
  let relayError
  const openSockets = new Set()
  const server = createServer((request, response) => {
    if (request.url !== "/state") {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ openSockets: openSockets.size }))
  })
  const websocket = new WebSocketServer({ server })
  websocket.on("connection", (socket) => {
    connections += 1
    openSockets.add(socket)
    let challenge
    let publicKey
    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(String(raw))
        if (message.type === "hello") {
          publicKey = Buffer.from(message.pubkey, "base64")
          assert.equal(publicKey.length, 32)
          assert.match(message.room_id, /^[A-Za-z0-9_-]{12}$/)
          challenge = randomBytes(32)
          hellos += 1
          socket.send(
            JSON.stringify({
              type: "challenge",
              nonce: challenge.toString("base64"),
            }),
          )
        } else if (message.type === "auth") {
          assert.ok(challenge && publicKey)
          const signature = Buffer.from(message.sig, "base64")
          assert.equal(signature.length, 64)
          const spki = Buffer.concat([
            Buffer.from("302a300506032b6570032100", "hex"),
            publicKey,
          ])
          assert.equal(
            verify(
              null,
              challenge,
              createPublicKey({ key: spki, format: "der", type: "spki" }),
              signature,
            ),
            true,
          )
          authentications += 1
        }
      } catch (error) {
        relayError ??= error
        socket.terminate()
      }
    })
    socket.on("close", () => {
      openSockets.delete(socket)
      closes += 1
    })
  })

  await new Promise((resolvePromise, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolvePromise)
  })
  const address = server.address()
  assert.ok(address && typeof address === "object")
  const relayUrl = `http://127.0.0.1:${address.port}`

  try {
    const cancel = await runChild("cancel", remotePiEntry, relayUrl)
    assert.equal(cancel.stderr, "")
    const lifecycle = await runChild("lifecycle", remotePiEntry, relayUrl)
    if (relayError) throw relayError
    assert.match(lifecycle.stderr, /using file-backed identity/)
    assert.equal(connections, 2)
    assert.equal(hellos, 2)
    assert.equal(authentications, 2)
    assert.equal(closes, 2)
    assert.equal(openSockets.size, 0)
    process.stdout.write(
      `Real Pi remote-pi smoke passed: registration, cancel, local relay, restart, UDS, tools\n`,
    )
  } finally {
    for (const client of websocket.clients) client.terminate()
    await new Promise((resolvePromise) => websocket.close(resolvePromise))
    await new Promise((resolvePromise, reject) =>
      server.close((error) => (error ? reject(error) : resolvePromise())),
    )
  }
}
