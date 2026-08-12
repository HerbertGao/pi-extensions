import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  truncate,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const piCli = join(
  root,
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "dist",
  "cli.js",
)
const contentMarker = "RESTOREDEXTERNALCACHEMARKER"
const jinaMarker = "JINAINLINECACHEMARKER"
const geminiMarker = "GEMINIWEBTRANSPORTMARKER"
const pdfMarker = "PDFEXTRACTIONMARKER"
const imagePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

function createPdf(text) {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let body = "%PDF-1.4\n"
  const offsets = [0]
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body)
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function createPackageJiti(webAccessEntry) {
  const require = createRequire(webAccessEntry)
  const { createJiti } = await import(pathToFileURL(require.resolve("jiti")))
  return createJiti(webAccessEntry, { moduleCache: false })
}

function inspectRegistration(webAccessEntry, agentDir) {
  const loaderPath = join(
    root,
    "node_modules",
    "@earendil-works",
    "pi-coding-agent",
    "dist",
    "core",
    "extensions",
    "loader.js",
  )
  const script = `
    import { pathToFileURL } from "node:url";
    const [entry, loader] = process.argv.slice(1);
    const { loadExtensions } = await import(pathToFileURL(loader));
    const result = await loadExtensions([entry], process.cwd());
    if (result.errors.length) throw new Error(JSON.stringify(result.errors));
    const extension = result.extensions[0];
    console.log(JSON.stringify({ tools: [...extension.tools.keys()], commands: [...extension.commands.keys()] }));
  `
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script, webAccessEntry, loaderPath],
    {
      cwd: root,
      env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
      encoding: "utf8",
      timeout: 30_000,
    },
  )
  assert.equal(
    result.status,
    0,
    `Registration inspection failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
  return JSON.parse(result.stdout.trim().split("\n").at(-1))
}

async function assertRegistrationGates({
  webAccessEntry,
  configPath,
  agentDir,
  baseConfig,
}) {
  const allTools = [
    "web_search",
    "source_check",
    "fetch_content",
    "get_search_content",
  ]
  const allCommands = ["websearch", "curator", "google-account", "search"]

  assert.deepEqual(inspectRegistration(webAccessEntry, agentDir), {
    tools: allTools,
    commands: allCommands,
  })

  await writeJson(configPath, { ...baseConfig, webSearch: { enabled: false } })
  assert.deepEqual(inspectRegistration(webAccessEntry, agentDir), {
    tools: ["fetch_content", "get_search_content"],
    commands: allCommands,
  })

  await writeJson(configPath, {
    ...baseConfig,
    tools: Object.fromEntries(
      ["webSearch", "sourceCheck", "fetchContent", "getSearchContent"].map(
        (name) => [name, { enabled: false }],
      ),
    ),
    commands: Object.fromEntries(
      ["websearch", "curator", "google-account", "search"].map((name) => [
        name,
        { enabled: false },
      ]),
    ),
  })
  assert.deepEqual(inspectRegistration(webAccessEntry, agentDir), {
    tools: [],
    commands: [],
  })
  await writeJson(configPath, baseConfig)
}

async function assertGeminiWebTransport(webAccessEntry) {
  const jiti = await createPackageJiti(webAccessEntry)
  const gemini = await jiti.import(
    join(dirname(webAccessEntry), "gemini-web.ts"),
  )
  const require = createRequire(webAccessEntry)
  const undici = await import(pathToFileURL(require.resolve("undici")))
  const agentOptions = []
  const dispatchers = new Set()
  const calls = []

  class CapturingAgent extends undici.EnvHttpProxyAgent {
    constructor(options) {
      super(options)
      agentOptions.push(options)
    }
  }

  const inner = []
  inner[4] = [[null, [geminiMarker]]]
  const part = []
  part[2] = JSON.stringify(inner)
  const responseBody = JSON.stringify([part])
  const transport = gemini.createGeminiFetch({
    ...undici,
    EnvHttpProxyAgent: CapturingAgent,
    fetch: async (input, init) => {
      calls.push({ url: String(input), init })
      dispatchers.add(init.dispatcher)
      return calls.length === 1
        ? new Response('"SNlM0e":"smoke-token"')
        : new Response(responseBody)
    },
  })

  gemini.setGeminiFetchOverrideForTests(transport)
  try {
    assert.equal(
      await gemini.queryWithCookies("Gemini web smoke", {
        "__Secure-1PSID": "smoke-cookie",
      }),
      geminiMarker,
    )
    assert.deepEqual(
      calls.map((call) => new URL(call.url).hostname),
      ["gemini.google.com", "gemini.google.com"],
    )
    assert.equal(agentOptions[0].maxHeaderSize, gemini.GEMINI_MAX_HEADER_SIZE)
    assert.ok(
      [...dispatchers].every(
        (dispatcher) => dispatcher instanceof undici.EnvHttpProxyAgent,
      ),
    )
  } finally {
    gemini.setGeminiFetchOverrideForTests(null)
    await Promise.all([...dispatchers].map((dispatcher) => dispatcher.close()))
  }
}

async function assertCacheLimits(webAccessEntry, agentDir, cacheDir) {
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR
  process.env.PI_CODING_AGENT_DIR = agentDir
  try {
    await rm(cacheDir, { recursive: true, force: true })
    const storage = await (
      await createPackageJiti(webAccessEntry)
    ).import(join(dirname(webAccessEntry), "storage.ts"))
    const store = (id, content) =>
      storage.storeFetchedContentResult(id, {
        id,
        type: "fetch",
        timestamp: Date.now(),
        urls: [
          {
            url: `https://example.com/${id}`,
            title: id,
            content,
            error: null,
          },
        ],
      })

    const first = store("quota-000", "first")
    const firstKey = first.fetchCache.key
    const old = new Date(Date.now() - 30_000)
    await utimes(join(cacheDir, firstKey), old, old)
    for (let index = 1; index <= 128; index++) {
      store(`quota-${String(index).padStart(3, "0")}`, `entry-${index}`)
    }
    const boundedEntries = (await readdir(cacheDir)).filter((name) =>
      name.endsWith(".json"),
    )
    assert.equal(boundedEntries.length, 128)
    assert.ok(!boundedEntries.includes(firstKey), "Oldest cache entry survived")

    const expiredPath = join(cacheDir, "expired.json")
    await writeFile(expiredPath, "{}", { mode: 0o600 })
    const expired = new Date(Date.now() - 2 * 60 * 60 * 1000)
    await utimes(expiredPath, expired, expired)
    storage.pruneExpiredFetchCache()
    await assert.rejects(stat(expiredPath), { code: "ENOENT" })

    await rm(cacheDir, { recursive: true, force: true })
    await mkdir(cacheDir, { recursive: true, mode: 0o700 })
    await Promise.all(
      ["large-a.json", "large-b.json"].map(async (name) => {
        const path = join(cacheDir, name)
        await writeFile(path, "", { mode: 0o600 })
        await truncate(path, 70 * 1024 * 1024)
      }),
    )
    storage.pruneExpiredFetchCache()
    const remaining = (await readdir(cacheDir)).filter((name) =>
      name.endsWith(".json"),
    )
    const totalBytes = (
      await Promise.all(remaining.map((name) => stat(join(cacheDir, name))))
    ).reduce((total, info) => total + info.size, 0)
    assert.ok(remaining.length <= 128)
    assert.ok(totalBytes <= 128 * 1024 * 1024)
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir
  }
}

function resultText(event) {
  return messageText(event?.result?.content)
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

async function startMockServer() {
  const requests = []
  const pdfPath = `/fixture-${randomBytes(8).toString("hex")}.pdf`
  const server = createServer((request, response) => {
    if (request.url === "/page-a" || request.url === "/page-b") {
      const page = request.url.endsWith("a") ? "A" : "B"
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      response.end(
        `<!doctype html><html><head><title>Smoke ${page}</title></head><body><main><h1>Smoke ${page}</h1><p>${`${contentMarker}-${page} `.repeat(40)}</p></main></body></html>`,
      )
      return
    }
    if (request.url === "/image.png") {
      response.writeHead(200, { "content-type": "image/png" })
      response.end(imagePng)
      return
    }
    if (request.url === pdfPath) {
      response.writeHead(200, { "content-type": "application/pdf" })
      response.end(createPdf(pdfMarker))
      return
    }

    let raw = ""
    request.setEncoding("utf8")
    request.on("data", (chunk) => {
      raw += chunk
    })
    request.on("end", () => {
      try {
        const body = JSON.parse(raw)
        requests.push({ path: request.url, body })

        if (request.url === "/responses") {
          const address = server.address()
          assert.ok(address && typeof address === "object")
          const sources = ["page-a", "page-b"].map((path, index) => ({
            url: `http://127.0.0.1:${address.port}/${path}`,
            title: `Smoke ${index === 0 ? "A" : "B"}`,
          }))
          response.writeHead(200, { "content-type": "application/json" })
          response.end(
            JSON.stringify({
              output: [
                {
                  type: "message",
                  role: "assistant",
                  content: [
                    {
                      type: "output_text",
                      text: "Mock search found two local sources.",
                      annotations: sources.map((source) => ({
                        type: "url_citation",
                        ...source,
                      })),
                    },
                  ],
                },
                { type: "web_search_call", action: { sources } },
              ],
            }),
          )
          return
        }

        const messages = Array.isArray(body.messages) ? body.messages : []
        const lastUserIndex = messages.findLastIndex(
          (message) => message.role === "user",
        )
        const prompt = messageText(messages[lastUserIndex]?.content)
        const toolResults = messages
          .slice(lastUserIndex + 1)
          .filter((message) => message.role === "tool").length
        const address = server.address()
        assert.ok(address && typeof address === "object")
        const urls = ["page-a", "page-b", "image.png", pdfPath.slice(1)].map(
          (path) => `http://127.0.0.1:${address.port}/${path}`,
        )

        let name
        let args
        if (prompt.startsWith("RUN_WEB_SMOKE") && toolResults === 0) {
          name = "web_search"
          args = {
            query: "aggregate web access smoke",
            provider: "openai",
            workflow: "none",
          }
        } else if (prompt.startsWith("RUN_WEB_SMOKE") && toolResults === 1) {
          name = "web_search"
          args = {
            query: "DuckDuckGo aggregate smoke",
            provider: "duckduckgo",
            workflow: "none",
          }
        } else if (prompt.startsWith("RUN_WEB_SMOKE") && toolResults === 2) {
          name = "web_search"
          args = {
            query: "Jina aggregate smoke",
            provider: "jina",
            includeContent: true,
            workflow: "none",
          }
        } else if (prompt.startsWith("RUN_WEB_SMOKE") && toolResults === 3) {
          name = "fetch_content"
          args = { urls }
        } else if (prompt.startsWith("RUN_MEDIA_GATES") && toolResults === 0) {
          name = "fetch_content"
          args = { urls: urls.slice(2) }
        } else if (
          prompt.startsWith("RESTORE_WEB_SMOKE") &&
          toolResults === 0
        ) {
          name = "get_search_content"
          args = {
            responseId: prompt.split(" ")[1],
            urlIndex: 0,
          }
        }

        if (!name) {
          sendSse(response, { content: "smoke complete" })
          return
        }
        sendSse(
          response,
          {
            tool_calls: [
              {
                index: 0,
                id: `call_smoke_${randomBytes(4).toString("hex")}`,
                type: "function",
                function: { name, arguments: JSON.stringify(args) },
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
  assert.ok(address && typeof address === "object")
  return {
    port: address.port,
    pdfPath,
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
        new Error(
          `Pi web smoke timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      )
    }, 45_000)
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk
    })
    child.once("error", reject)
    child.once("close", (code, signal) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(
          new Error(
            `Pi web smoke exited with ${code ?? signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        )
        return
      }
      resolvePromise({ stdout, stderr })
    })
  })
}

function parseEvents(stdout) {
  return stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line))
}

async function findSessionFile(sessionDir) {
  const entries = await readdir(sessionDir, { recursive: true })
  const files = entries
    .filter((entry) => entry.endsWith(".jsonl"))
    .map((entry) => join(sessionDir, entry))
  assert.equal(files.length, 1, `Expected one Pi session, got ${files.length}`)
  return files[0]
}

export async function runPiWebAccessRealSmoke({ webAccessEntry }) {
  assert.ok(webAccessEntry, "webAccessEntry is required")
  const resolvedWebAccessEntry = resolve(webAccessEntry)
  const stageDir = await mkdtemp(join(tmpdir(), "pi-web-access-real-smoke-"))
  const mock = await startMockServer()
  try {
    const agentDir = join(stageDir, "agent")
    const sessionDir = join(stageDir, "sessions")
    const workDir = join(stageDir, "work")
    await Promise.all([
      mkdir(agentDir, { recursive: true }),
      mkdir(sessionDir, { recursive: true }),
      mkdir(workDir, { recursive: true }),
    ])
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
    const configPath = join(agentDir, "web-search.json")
    const baseConfig = {
      openaiApiKey: "smoke-search-key",
      openaiResponsesUrl: `http://127.0.0.1:${mock.port}/responses`,
      openaiSearchModel: "smoke-search-model",
      jinaApiKey: "smoke-jina-key",
      workflow: "none",
      ssrf: { allowRanges: ["127.0.0.0/8"] },
    }
    await writeJson(configPath, baseConfig)
    await assertRegistrationGates({
      webAccessEntry: resolvedWebAccessEntry,
      configPath,
      agentDir,
      baseConfig,
    })
    await assertGeminiWebTransport(resolvedWebAccessEntry)

    const providerPreload = join(
      root,
      "scripts",
      "pi-web-access-provider-preload.mjs",
    )
    const existingNodeOptions = process.env.NODE_OPTIONS?.trim()
    const env = {
      ...process.env,
      HOME: join(stageDir, "home"),
      PI_CODING_AGENT_DIR: agentDir,
      PI_WEB_ACCESS_JINA_MARKER: jinaMarker,
      NODE_OPTIONS: `${existingNodeOptions ? `${existingNodeOptions} ` : ""}--import=${providerPreload}`,
    }
    const baseArgs = [
      "--offline",
      "--no-context-files",
      "--no-skills",
      "--no-extensions",
      "--extension",
      resolvedWebAccessEntry,
      "--provider",
      "smoke",
      "--model",
      "smoke-model",
      "--api-key",
      "smoke-placeholder",
      "--mode",
      "json",
      "--print",
      "--session-dir",
      sessionDir,
    ]

    const first = await runPi([...baseArgs, "RUN_WEB_SMOKE"], {
      cwd: workDir,
      env,
    })
    const firstEvents = parseEvents(first.stdout)
    const searchEnds = firstEvents.filter(
      (event) =>
        event.type === "tool_execution_end" && event.toolName === "web_search",
    )
    assert.equal(searchEnds.length, 3)
    for (const event of searchEnds) {
      assert.equal(event.isError, false, JSON.stringify(event.result, null, 2))
      assert.equal(
        event.result.details.successfulQueries,
        1,
        JSON.stringify(event.result, null, 2),
      )
    }
    assert.deepEqual(
      searchEnds.map((event) => event.result.details.totalResults),
      [2, 1, 1],
    )
    assert.match(
      resultText(searchEnds[0]),
      /Mock search found two local sources/,
    )
    assert.match(resultText(searchEnds[1]), /DuckDuckGo provider marker/)
    assert.match(resultText(searchEnds[2]), /Jina provider marker/)
    const responseId = searchEnds[2].result.details.fetchId
    assert.ok(responseId, "Jina web_search did not externalize inline content")
    assert.equal(
      mock.requests.filter((request) => request.path === "/responses").length,
      1,
      "web_search did not use the configured OpenAI Responses endpoint",
    )

    const fetchEnd = firstEvents.find(
      (event) =>
        event.type === "tool_execution_end" &&
        event.toolName === "fetch_content",
    )
    assert.equal(fetchEnd?.isError, false)
    assert.equal(
      fetchEnd.result.details.successful,
      4,
      JSON.stringify(fetchEnd.result, null, 2),
    )
    assert.match(resultText(fetchEnd), /image\.png/)
    const sessionFile = await findSessionFile(sessionDir)
    const sessionJsonl = await readFile(sessionFile, "utf8")
    assert.ok(
      !sessionJsonl.includes(contentMarker) &&
        !sessionJsonl.includes(jinaMarker),
      "Session JSONL embedded full fetched content",
    )
    const fetchEntry = sessionJsonl
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .find(
        (entry) =>
          entry.type === "custom" &&
          entry.customType === "web-search-results" &&
          entry.data?.id === responseId,
      )
    assert.ok(
      fetchEntry?.data?.fetchCache,
      "Session entry has no cache reference",
    )
    assert.equal(fetchEntry.data.urls, undefined)

    const cacheDir = join(agentDir, "web-search-cache")
    const cacheFiles = (await readdir(cacheDir)).filter((name) =>
      name.endsWith(".json"),
    )
    assert.equal(cacheFiles.length, 2)
    const cachePath = join(cacheDir, fetchEntry.data.fetchCache.key)
    const cached = await readFile(cachePath, "utf8")
    assert.ok(cached.includes(jinaMarker), cached)
    const fetchCache = (
      await Promise.all(
        cacheFiles.map((name) => readFile(join(cacheDir, name), "utf8")),
      )
    ).find((contents) => contents.includes(mock.pdfPath))
    assert.ok(fetchCache, "fetch_content cache did not include the PDF result")
    const pdfResult = JSON.parse(fetchCache).urls.find(({ url }) =>
      url.endsWith(mock.pdfPath),
    )
    const pdfOutputPath = pdfResult?.content.match(
      /PDF extracted and saved to: ([^\n]+)/,
    )?.[1]
    assert.ok(pdfOutputPath, "PDF fetch did not report extracted output")
    assert.match(await readFile(pdfOutputPath, "utf8"), new RegExp(pdfMarker))
    await rm(pdfOutputPath, { force: true })
    if (process.platform !== "win32") {
      assert.equal((await stat(cacheDir)).mode & 0o777, 0o700)
      assert.equal((await stat(cachePath)).mode & 0o777, 0o600)
    }
    assert.ok((await stat(cachePath)).size <= 128 * 1024 * 1024)

    await writeJson(configPath, {
      ...baseConfig,
      image: { enabled: false },
      pdf: { enabled: false },
    })
    const disabledMedia = await runPi(
      [...baseArgs, "--no-session", "RUN_MEDIA_GATES"],
      { cwd: workDir, env },
    )
    const disabledMediaEnd = parseEvents(disabledMedia.stdout).find(
      (event) =>
        event.type === "tool_execution_end" &&
        event.toolName === "fetch_content",
    )
    assert.equal(disabledMediaEnd?.isError, false)
    assert.equal(disabledMediaEnd.result.details.successful, 0)
    assert.match(resultText(disabledMediaEnd), /Image fetching is disabled/)
    assert.match(resultText(disabledMediaEnd), /PDF extraction is disabled/)
    await writeJson(configPath, baseConfig)

    const staleTemp = join(cacheDir, `stale.json.1.1.${"0".repeat(32)}.tmp`)
    await writeFile(staleTemp, "stale")
    const staleTime = new Date(Date.now() - 2 * 60 * 60 * 1000)
    await utimes(staleTemp, staleTime, staleTime)

    const restored = await runPi(
      [
        ...baseArgs,
        "--session",
        sessionFile,
        `RESTORE_WEB_SMOKE ${responseId}`,
      ],
      { cwd: workDir, env },
    )
    const restoredEnd = parseEvents(restored.stdout).find(
      (event) =>
        event.type === "tool_execution_end" &&
        event.toolName === "get_search_content",
    )
    assert.equal(restoredEnd?.isError, false)
    assert.ok(JSON.stringify(restoredEnd.result).includes(jinaMarker))
    await assert.rejects(stat(staleTemp), { code: "ENOENT" })

    await writeFile(cachePath, "{corrupt")
    const corrupt = await runPi(
      [
        ...baseArgs,
        "--session",
        sessionFile,
        `RESTORE_WEB_SMOKE ${responseId}`,
      ],
      { cwd: workDir, env },
    )
    const corruptEnd = parseEvents(corrupt.stdout).find(
      (event) =>
        event.type === "tool_execution_end" &&
        event.toolName === "get_search_content",
    )
    assert.equal(corruptEnd?.isError, false)
    assert.match(
      resultText(corruptEnd),
      /Cached fetched content could not be read/,
    )

    await unlink(cachePath)
    const missing = await runPi(
      [
        ...baseArgs,
        "--session",
        sessionFile,
        `RESTORE_WEB_SMOKE ${responseId}`,
      ],
      { cwd: workDir, env },
    )
    const missingEnd = parseEvents(missing.stdout).find(
      (event) =>
        event.type === "tool_execution_end" &&
        event.toolName === "get_search_content",
    )
    assert.equal(missingEnd?.isError, false)
    assert.match(
      resultText(missingEnd),
      /Cached fetched content is missing or expired/,
    )

    await assertCacheLimits(resolvedWebAccessEntry, agentDir, cacheDir)

    process.stdout.write(
      "Real Pi web-access smoke passed: search, external cache, restart retrieval, graceful degradation\n",
    )
  } finally {
    await mock.close()
    await rm(stageDir, { recursive: true, force: true })
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runPiWebAccessRealSmoke({ webAccessEntry: process.argv[2] }).catch(
    (error) => {
      process.stderr.write(
        `${error instanceof Error ? error.stack : String(error)}\n`,
      )
      process.exitCode = 1
    },
  )
}
