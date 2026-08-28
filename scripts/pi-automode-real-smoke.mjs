import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import {
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const piCli = join(
  root,
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "dist",
  "cli.js",
)

function assert(condition, message, details) {
  if (condition) return
  const suffix =
    details === undefined ? "" : `\n${JSON.stringify(details, null, 2)}`
  throw new Error(`${message}${suffix}`)
}

function messageText(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : typeof entry?.text === "string"
          ? entry.text
          : "",
    )
    .join("")
}

function sendSse(response, delta, finishReason = "stop") {
  const base = {
    id: `chatcmpl-smoke-${randomBytes(4).toString("hex")}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "smoke-model",
  }
  response.writeHead(200, {
    "cache-control": "no-cache",
    connection: "keep-alive",
    "content-type": "text/event-stream",
  })
  response.write(
    `data: ${JSON.stringify({
      ...base,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", ...delta },
          finish_reason: null,
        },
      ],
    })}\n\n`,
  )
  response.write(
    `data: ${JSON.stringify({
      ...base,
      choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
    })}\n\n`,
  )
  response.end("data: [DONE]\n\n")
}

async function startMockProvider(blockedClassifierPath, hangingClassifierPath) {
  const requests = []
  const server = createServer((request, response) => {
    let raw = ""
    request.setEncoding("utf8")
    request.on("data", (chunk) => {
      raw += chunk
    })
    request.on("end", () => {
      try {
        const body = JSON.parse(raw)
        const messages = Array.isArray(body.messages) ? body.messages : []
        const allText = messages
          .map((message) => messageText(message.content))
          .join("\n")
        const classifier = allText.includes(
          "security classifier for an autonomous coding agent",
        )
        requests.push({ body, classifier })

        if (classifier) {
          if (allText.includes(hangingClassifierPath)) {
            response.writeHead(200, {
              "cache-control": "no-cache",
              connection: "keep-alive",
              "content-type": "text/event-stream",
            })
            response.write(": classifier stream intentionally left open\n\n")
            return
          }
          const detailed = allText.includes("Return only JSON exactly matching")
          const shouldBlock = allText.includes(blockedClassifierPath)
          if (detailed) {
            sendSse(response, {
              content: shouldBlock
                ? '{"decision":"block","tier":"soft_deny","reason":"smoke classifier denial"}'
                : '{"decision":"allow","tier":"none","reason":"smoke classifier allow"}',
            })
          } else {
            sendSse(response, { content: shouldBlock ? "1" : "0" })
          }
          return
        }

        if (messages.some((message) => message.role === "tool")) {
          sendSse(response, { content: "done" })
          return
        }

        const user = messages.findLast((message) => message.role === "user")
        const match = messageText(user?.content).match(
          /^CALL\s+(read|bash)\s+([\s\S]+)$/,
        )
        if (!match) {
          sendSse(response, { content: "unexpected smoke prompt" })
          return
        }
        const [, toolName, argument] = match
        const args =
          toolName === "read" ? { path: argument } : { command: argument }
        sendSse(
          response,
          {
            tool_calls: [
              {
                index: 0,
                id: `call_smoke_${randomBytes(4).toString("hex")}`,
                type: "function",
                function: { name: toolName, arguments: JSON.stringify(args) },
              },
            ],
          },
          "tool_calls",
        )
      } catch (error) {
        response.writeHead(500, { "content-type": "text/plain" })
        response.end(error instanceof Error ? error.stack : String(error))
      }
    })
  })

  await new Promise((resolvePromise, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolvePromise)
  })
  const address = server.address()
  assert(
    address && typeof address === "object",
    "Mock provider did not bind a TCP port",
  )
  return {
    port: address.port,
    requests,
    close: () =>
      new Promise((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      ),
  }
}

function runPi(args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [piCli, ...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(
        new Error(`Pi smoke timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`),
      )
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
      if (code !== 0) {
        reject(
          new Error(
            `Pi smoke exited with ${code ?? signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        )
        return
      }
      resolvePromise({ stdout, stderr })
    })
  })
}

function parseJsonEvents(stdout, caseName) {
  return stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(
          `${caseName}: invalid Pi JSON event: ${line}\n${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        )
      }
    })
}

function latestAutomodeState(events) {
  return events.findLast(
    (event) =>
      event.type === "entry_appended" &&
      event.entry?.customType === "pi-automode-state",
  )?.entry.data
}

function classifierRequests(requests) {
  return requests.filter((request) => request.classifier)
}

export async function runPiAutomodeRealSmoke({ automodeEntry }) {
  assert(automodeEntry, "automodeEntry is required")
  await lstat(automodeEntry)
  await lstat(piCli)

  const stageDir = await mkdtemp(join(tmpdir(), "automode-real-smoke-"))
  const randomHome = `/var/home/pi-smoke-${randomBytes(18).toString("hex")}`
  try {
    try {
      await lstat(randomHome)
      throw new Error(`Refusing to use existing synthetic HOME: ${randomHome}`)
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }

    const workDir = join(stageDir, "work")
    const outsideDir = join(stageDir, "outside")
    const agentDir = join(stageDir, "agent")
    const ordinaryHome = join(stageDir, "home")
    const declaredTempRoot = join(stageDir, "declared-temp")
    const declaredTempChild = join(declaredTempRoot, "cleanup-child")
    await Promise.all([
      mkdir(workDir, { recursive: true }),
      mkdir(outsideDir, { recursive: true }),
      mkdir(agentDir, { recursive: true }),
      mkdir(ordinaryHome, { recursive: true }),
      mkdir(declaredTempChild, { recursive: true }),
    ])
    await writeFile(join(workDir, "inside.txt"), "inside-smoke-marker\n")
    await writeFile(join(workDir, "blocked.txt"), "denied-smoke-marker\n")
    await writeFile(join(outsideDir, "outside.txt"), "outside-smoke-marker\n")
    await writeFile(join(outsideDir, "secret.txt"), "secret-smoke-marker\n")
    await writeFile(
      join(declaredTempChild, "temporary.txt"),
      "temporary-smoke-marker\n",
    )
    await symlink(outsideDir, join(workDir, "link-out"))

    // macOS aliases /tmp to /private/tmp. Policy patterns must use the same
    // canonical namespace as the extension's realpath-based checks.
    const canonicalWork = await realpath(workDir)
    const canonicalOutside = await realpath(outsideDir)
    const blockedClassifierPath = `${randomHome}/never-created-child`
    const hangingClassifierPath = join(
      declaredTempRoot,
      "hanging-classifier-child",
    )
    const hangingSentinelPath = join(hangingClassifierPath, "sentinel.txt")
    await mkdir(hangingClassifierPath, { recursive: true })
    await writeFile(hangingSentinelPath, "classifier-timeout-sentinel\n")
    const mock = await startMockProvider(
      blockedClassifierPath,
      hangingClassifierPath,
    )
    try {
      await writeFile(
        join(agentDir, "models.json"),
        `${JSON.stringify(
          {
            providers: {
              smoke: {
                baseUrl: `http://127.0.0.1:${mock.port}/v1`,
                api: "openai-completions",
                apiKey: "smoke-placeholder",
                compat: {
                  supportsUsageInStreaming: false,
                  supportsDeveloperRole: false,
                  supportsReasoningEffort: false,
                  maxTokensField: "max_tokens",
                },
                models: [
                  {
                    id: "smoke-model",
                    name: "Smoke Model",
                    reasoning: false,
                    input: ["text"],
                    contextWindow: 128000,
                    maxTokens: 4096,
                    cost: {
                      input: 0,
                      output: 0,
                      cacheRead: 0,
                      cacheWrite: 0,
                    },
                  },
                ],
              },
            },
          },
          null,
          2,
        )}\n`,
      )

      const baseArgs = [
        "--offline",
        "--no-session",
        "--no-context-files",
        "--no-skills",
        "--no-extensions",
        "--extension",
        automodeEntry,
        "--provider",
        "smoke",
        "--model",
        "smoke-model",
        "--api-key",
        "smoke-placeholder",
        "--mode",
        "json",
        "--print",
      ]

      async function runCase(
        name,
        { config, home = ordinaryHome, extraEnv = {}, prompt },
      ) {
        const requestStart = mock.requests.length
        const environment = {
          ...process.env,
          ...extraEnv,
          HOME: home,
          PI_CODING_AGENT_DIR: agentDir,
        }
        if (config !== undefined) {
          environment.PI_AUTOMODE_SETTINGS_JSON = JSON.stringify(config)
        } else {
          delete environment.PI_AUTOMODE_SETTINGS_JSON
        }
        const result = await runPi([...baseArgs, prompt], {
          cwd: canonicalWork,
          env: environment,
        })
        assert(
          result.stderr.trim() === "",
          `${name}: unexpected Pi stderr`,
          result,
        )
        const events = parseJsonEvents(result.stdout, name)
        const state = latestAutomodeState(events)
        assert(
          state,
          `${name}: packed pi-automode extension did not append state`,
          events,
        )
        return {
          events,
          state,
          requests: mock.requests.slice(requestStart),
        }
      }

      const defaultRead = await runCase("default-read", {
        prompt: "CALL read inside.txt",
      })
      assert(
        defaultRead.state.lastReason === "Read-only built-in tool: read",
        "default-read: read fast path was not used",
        defaultRead.state,
      )
      assert(
        classifierRequests(defaultRead.requests).length === 0,
        "default-read: classifier unexpectedly ran",
      )
      assert(
        defaultRead.events.some(
          (event) =>
            event.type === "tool_execution_end" && event.isError === false,
        ),
        "default-read: built-in read did not execute",
      )

      const inside = await runCase("inside-cwd", {
        config: { autoMode: { allowInsideWorkingDirectory: true } },
        prompt: "CALL read inside.txt",
      })
      assert(
        inside.state.lastReason?.startsWith("Path inside working directory:"),
        "inside-cwd: deterministic CWD allow tier was not used",
        inside.state,
      )
      assert(
        classifierRequests(inside.requests).length === 0,
        "inside-cwd: classifier unexpectedly ran",
      )

      const outside = await runCase("outside-cwd", {
        config: { autoMode: { allowInsideWorkingDirectory: true } },
        prompt: `CALL read ${canonicalOutside}/outside.txt`,
      })
      assert(
        classifierRequests(outside.requests).length === 1,
        "outside-cwd: read did not reach fast classifier",
        outside.requests,
      )
      assert(
        outside.state.classifierAllowed === 1,
        "outside-cwd: classifier allow was not recorded",
        outside.state,
      )

      async function assertPathDenied(name, configPattern, path) {
        const result = await runCase(name, {
          config: { autoMode: { deniedPaths: [configPattern] } },
          prompt: `CALL read ${path}`,
        })
        assert(
          classifierRequests(result.requests).length === 0,
          `${name}: denied path reached classifier`,
        )
        assert(
          result.state.blockedActions === 1,
          `${name}: denied path was not blocked`,
          result.state,
        )
        assert(
          result.state.recentDenials?.at(-1)?.kind ===
            "deterministic-path-deny",
          `${name}: wrong denial kind`,
          result.state,
        )
        const toolEnd = result.events.find(
          (event) => event.type === "tool_execution_end",
        )
        assert(
          toolEnd?.isError === true,
          `${name}: blocked read was reported as successful`,
          toolEnd,
        )
        assert(
          !JSON.stringify(toolEnd).includes("secret-smoke-marker") &&
            !JSON.stringify(toolEnd).includes("denied-smoke-marker"),
          `${name}: blocked file content leaked`,
          toolEnd,
        )
      }

      await assertPathDenied(
        "explicit-denied-path",
        `${canonicalWork}/blocked.txt`,
        "blocked.txt",
      )
      await assertPathDenied(
        "symlink-denied-path",
        `${canonicalOutside}/*`,
        "link-out/secret.txt",
      )
      await assertPathDenied(
        "traversal-denied-path",
        `${canonicalOutside}/*`,
        "../outside/secret.txt",
      )

      const classifiedRead = await runCase("classified-read", {
        config: { autoMode: { classifyReadOnlyTools: true } },
        prompt: "CALL read inside.txt",
      })
      assert(
        classifierRequests(classifiedRead.requests).length === 1,
        "classified-read: classifier did not run",
        classifiedRead.requests,
      )
      assert(
        classifiedRead.state.classifierAllowed === 1,
        "classified-read: classifier allow was not recorded",
        classifiedRead.state,
      )

      const tokenBudget = 73
      const tokenCase = await runCase("fast-classifier-token-budget", {
        config: {
          autoMode: {
            classifyReadOnlyTools: true,
            fastClassifierMaxTokens: tokenBudget,
          },
        },
        prompt: "CALL read inside.txt",
      })
      const tokenRequests = classifierRequests(tokenCase.requests)
      assert(
        tokenRequests.length === 1,
        "fast-classifier-token-budget: expected one classifier request",
        tokenRequests,
      )
      assert(
        tokenRequests[0].body.max_tokens === tokenBudget,
        "fast-classifier-token-budget: max_tokens did not reflect config",
        tokenRequests[0].body,
      )

      const timedOut = await runCase("classifier-stream-timeout", {
        config: { autoMode: { classifierTimeoutMs: 1_000 } },
        extraEnv: { TMPDIR: declaredTempRoot },
        prompt: `CALL bash rm -rf ${hangingClassifierPath}`,
      })
      assert(
        classifierRequests(timedOut.requests).length === 1,
        "classifier-stream-timeout: expected one hanging classifier request",
        timedOut.requests,
      )
      assert(
        timedOut.state.blockedActions === 1 &&
          /timed out after 1000 ms/i.test(timedOut.state.lastReason ?? ""),
        "classifier-stream-timeout: timeout did not fail closed",
        timedOut.state,
      )
      const timedOutTool = timedOut.events.find(
        (event) => event.type === "tool_execution_end",
      )
      assert(
        timedOutTool?.isError === true,
        "classifier-stream-timeout: blocked command was reported as successful",
        timedOutTool,
      )
      await lstat(hangingSentinelPath)

      const tempRoot = await runCase("temp-root", {
        config: {},
        extraEnv: { TMPDIR: declaredTempRoot },
        prompt: `CALL bash rm -rf ${declaredTempRoot}`,
      })
      assert(
        classifierRequests(tempRoot.requests).length === 0 &&
          tempRoot.state.recentDenials?.at(-1)?.kind ===
            "deterministic-hard-deny",
        "temp-root: declared temp root was not hard-denied",
        tempRoot.state,
      )
      await lstat(declaredTempRoot)

      const tempChild = await runCase("temp-child", {
        config: {},
        extraEnv: { TMPDIR: declaredTempRoot },
        prompt: `CALL bash rm -rf ${declaredTempChild}`,
      })
      assert(
        classifierRequests(tempChild.requests).length === 1 &&
          tempChild.state.classifierAllowed === 1,
        "temp-child: disposable temp subtree did not reach the classifier",
        tempChild.state,
      )
      try {
        await lstat(declaredTempChild)
        throw new Error(
          "temp-child: cleanup command did not remove the subtree",
        )
      } catch (error) {
        if (error?.code !== "ENOENT") throw error
      }

      const protectedTmpTarget = `/etc/automode-smoke-${randomBytes(12).toString("hex")}`
      try {
        await lstat(protectedTmpTarget)
        throw new Error(
          `Refusing to use existing protected-path fixture: ${protectedTmpTarget}`,
        )
      } catch (error) {
        if (error?.code !== "ENOENT") throw error
      }
      const invalidTmpdir = await runCase("invalid-tmpdir", {
        config: {},
        extraEnv: { TMPDIR: "/" },
        prompt: `CALL bash rm -rf ${protectedTmpTarget}`,
      })
      assert(
        classifierRequests(invalidTmpdir.requests).length === 0 &&
          invalidTmpdir.state.recentDenials?.at(-1)?.kind ===
            "deterministic-hard-deny",
        "invalid-tmpdir: TMPDIR=/ weakened protected-path denial",
        invalidTmpdir.state,
      )

      const homeChild = await runCase("var-home-child", {
        config: {},
        home: randomHome,
        prompt: `CALL bash rm -rf ${blockedClassifierPath}`,
      })
      assert(
        classifierRequests(homeChild.requests).length === 2,
        "var-home-child: request did not reach both classifier stages",
        homeChild.requests,
      )
      assert(
        homeChild.state.recentDenials?.at(-1)?.kind === "classifier",
        "var-home-child: request was not denied by classifier",
        homeChild.state,
      )
      assert(
        homeChild.state.lastReason === "smoke classifier denial",
        "var-home-child: unexpected denial reason",
        homeChild.state,
      )
      try {
        await lstat(randomHome)
        throw new Error(
          `var-home-child: synthetic HOME unexpectedly exists: ${randomHome}`,
        )
      } catch (error) {
        if (error?.code !== "ENOENT") throw error
      }

      const homeRoot = await runCase("var-home-root", {
        config: {},
        home: randomHome,
        prompt: `CALL bash rm -rf ${randomHome}`,
      })
      assert(
        classifierRequests(homeRoot.requests).length === 0,
        "var-home-root: deterministic hard deny unexpectedly called classifier",
        homeRoot.requests,
      )
      assert(
        homeRoot.state.recentDenials?.at(-1)?.kind ===
          "deterministic-hard-deny",
        "var-home-root: HOME root was not hard-denied",
        homeRoot.state,
      )
      assert(
        homeRoot.state.lastReason ===
          "irreversible deletion of home/root/system paths is hard-denied",
        "var-home-root: unexpected hard-deny reason",
        homeRoot.state,
      )

      const nestedHomeRoot = await runCase("nested-var-home-root", {
        config: {},
        home: randomHome,
        prompt: `CALL bash echo "$(rm -rf ${randomHome})"`,
      })
      assert(
        classifierRequests(nestedHomeRoot.requests).length === 0,
        "nested-var-home-root: nested hard deny unexpectedly called classifier",
        nestedHomeRoot.requests,
      )
      assert(
        nestedHomeRoot.state.recentDenials?.at(-1)?.kind ===
          "deterministic-hard-deny",
        "nested-var-home-root: nested HOME deletion was not hard-denied",
        nestedHomeRoot.state,
      )

      process.stdout.write(
        "Real Pi automode smoke passed: 15 cases, packed extension, localhost mock provider\n",
      )
    } finally {
      await mock.close()
    }
  } finally {
    await rm(stageDir, { recursive: true, force: true })
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const automodeEntry = process.argv[2]
  runPiAutomodeRealSmoke({ automodeEntry }).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    )
    process.exitCode = 1
  })
}
