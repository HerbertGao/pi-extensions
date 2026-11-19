import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  findPublishedManifestDrift,
  parseJson,
  parseNpmPackOutput,
} from "./npm-pack-json.mjs"
import { runPiWebAccessRealSmoke } from "./pi-web-access-real-smoke.mjs"
import { run } from "./process.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const aggregateDir = join(root, "packages", "pi-extensions")

const proxy =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy
const npmEnv = {
  ...process.env,
  ...(proxy
    ? {
        npm_config_proxy: proxy,
        npm_config_https_proxy: proxy,
        http_proxy: proxy,
        https_proxy: proxy,
      }
    : {}),
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === "ENOENT") return false
    throw error
  }
}

const majorOf = (value) => Number(value.replace(/^[\^~]/u, "").split(".")[0])

function matchesPinnedRange(pinned, range) {
  if (range === pinned) return true
  // shortcut: compares only the major version of ^/~ ranges; widen when bundled
  // packages adopt other range syntaxes.
  if (!/^[\^~]\d/u.test(range)) return true
  return majorOf(range) === majorOf(pinned)
}

const stageDir = await mkdtemp(join(tmpdir(), "pi-extensions-smoke-"))
process.env.PI_CODING_AGENT_DIR = join(stageDir, ".pi-agent")
const diagnosticsDir = process.env.AGGREGATE_SMOKE_ARTIFACT_DIR
const phaseLog = []
let currentPhase
let cleanupLoadedExtensions = async () => {}

function beginPhase(name) {
  if (currentPhase) {
    currentPhase.endedAt = new Date().toISOString()
    currentPhase.status = "passed"
  }
  currentPhase = {
    name,
    startedAt: new Date().toISOString(),
    status: "running",
  }
  phaseLog.push(currentPhase)
  process.stdout.write(`[aggregate-smoke] phase=${name}\n`)
}

function finishPhase(status, error) {
  if (!currentPhase) return
  currentPhase.endedAt = new Date().toISOString()
  currentPhase.status = status
  if (error) {
    currentPhase.error = error instanceof Error ? error.message : String(error)
  }
}

async function preserveFailureArtifact(error) {
  if (!diagnosticsDir) return
  try {
    await mkdir(diagnosticsDir, { recursive: true })
    const details = error instanceof Error ? error : new Error(String(error))
    await writeFile(
      join(diagnosticsDir, "aggregate-package-smoke.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          status: "failed",
          runId: process.env.GITHUB_RUN_ID ?? null,
          phase: currentPhase?.name ?? "initialization",
          phases: phaseLog,
          error: {
            name: details.name,
            message: details.message,
            stack: details.stack?.slice(0, 4000),
          },
        },
        null,
        2,
      )}\n`,
    )
  } catch (artifactError) {
    process.stderr.write(
      `[aggregate-smoke] failed to preserve diagnostics: ${artifactError instanceof Error ? artifactError.message : String(artifactError)}\n`,
    )
  }
}

try {
  beginPhase("pack-and-install")
  const packResult = run("npm", [
    "pack",
    "--json",
    "--pack-destination",
    stageDir,
    aggregateDir,
  ])
  if (packResult.stderr.includes("TAR_ENTRY_ERROR")) {
    throw new Error(packResult.stderr.trim())
  }

  const packed = parseNpmPackOutput(packResult.stdout, "npm pack output")
  if (packed.files.some(({ path }) => path.includes("pi-stash"))) {
    throw new Error("Packed aggregate still contains removed pi-stash files")
  }
  if (packed.files.some(({ path }) => path.includes("pi-titlebar-spinner"))) {
    throw new Error(
      "Packed aggregate still contains deprecated pi-titlebar-spinner files",
    )
  }
  const tarballPath = join(stageDir, packed.filename)
  const installDir = join(stageDir, "install")
  run(
    "npm",
    [
      "install",
      "--prefer-offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefix",
      installDir,
      tarballPath,
    ],
    { cwd: stageDir, env: npmEnv },
  )

  beginPhase("manifest-and-package-contracts")
  const packageRoot = join(
    installDir,
    "node_modules",
    "@herbertgao",
    "pi-extensions",
  )
  const manifestPath = join(packageRoot, "package.json")
  const manifest = parseJson(await readFile(manifestPath, "utf8"), manifestPath)
  const sourceManifestPath = join(aggregateDir, "package.json")
  const sourceManifest = parseJson(
    await readFile(sourceManifestPath, "utf8"),
    sourceManifestPath,
  )
  const metadataDrift = findPublishedManifestDrift(sourceManifest, manifest)
  if (metadataDrift.length > 0) {
    throw new Error(
      `Registry dependency metadata would differ from the tarball:\n${metadataDrift.join("\n")}`,
    )
  }
  const hostPeerDependencies = [
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
    "@sinclair/typebox",
    "typebox",
  ]
  for (const dependency of hostPeerDependencies) {
    if (
      sourceManifest.peerDependencies?.[dependency] !== "*" ||
      manifest.peerDependencies?.[dependency] !== "*" ||
      sourceManifest.dependencies?.[dependency] !== undefined ||
      manifest.dependencies?.[dependency] !== undefined
    ) {
      throw new Error(
        `Aggregate host package ${dependency} must be a wildcard peer, not a dependency`,
      )
    }
  }
  if (
    sourceManifest.dependencies?.["pi-mcp-adapter"] !== undefined ||
    manifest.dependencies?.["pi-mcp-adapter"] !== undefined ||
    manifest.bundledDependencies?.includes("pi-mcp-adapter") ||
    manifest.pi?.extensions?.some((entry) =>
      entry.includes("pi-mcp-adapter"),
    ) ||
    manifest.pi?.skills?.some((entry) => entry.includes("pi-mcp-adapter")) ||
    (await pathExists(join(packageRoot, "node_modules", "pi-mcp-adapter")))
  ) {
    throw new Error(
      "The aggregate must not bundle or register pi-mcp-adapter alongside Pi's native MCP",
    )
  }
  if (sourceManifest.engines?.node !== ">=22.19.0") {
    throw new Error("Aggregate Node baseline must stay at Pi's >=22.19.0")
  }

  // Aggregate contract only: every bundled package is pinned exactly, ships the
  // Pi entries the aggregate registers, promotes its runtime dependencies at the
  // range it asked for, and keeps host peers out of its own node_modules.
  // Upstream behavior belongs in that package's own tests, not here.
  const notices = await readFile(
    join(packageRoot, "THIRD_PARTY_NOTICES.md"),
    "utf8",
  )
  const bundledPackages = await Promise.all(
    manifest.bundledDependencies.map(async (packageName) => {
      const packageDir = join(
        packageRoot,
        "node_modules",
        ...packageName.split("/"),
      )
      const bundledManifestPath = join(packageDir, "package.json")
      const licenseFiles = await Promise.all(
        ["LICENSE", "LICENSE.md", "LICENSE.txt"].map((name) =>
          pathExists(join(packageDir, name)),
        ),
      )
      return {
        packageName,
        packageDir,
        shipsLicenseFile: licenseFiles.some(Boolean),
        manifest: parseJson(
          await readFile(bundledManifestPath, "utf8"),
          bundledManifestPath,
        ),
      }
    }),
  )
  const nestedHosts = (
    await Promise.all(
      bundledPackages.flatMap(({ packageName, packageDir }) =>
        hostPeerDependencies.map(async (hostDependency) => ({
          packageName,
          hostDependency,
          nested: await pathExists(
            join(packageDir, "node_modules", ...hostDependency.split("/")),
          ),
        })),
      ),
    )
  ).filter(({ nested }) => nested)
  if (nestedHosts.length > 0) {
    throw new Error(
      `Bundled packages must not nest host peers: ${nestedHosts
        .map(
          ({ packageName, hostDependency }) =>
            `${packageName}/${hostDependency}`,
        )
        .join(", ")}`,
    )
  }
  for (const {
    packageName,
    shipsLicenseFile,
    manifest: bundledManifest,
  } of bundledPackages) {
    const pinned = sourceManifest.dependencies?.[packageName]
    if (typeof pinned !== "string" || !/^\d/.test(pinned)) {
      throw new Error(
        `Bundled ${packageName} must be pinned to an exact version, got ${pinned}`,
      )
    }
    if (bundledManifest.version !== pinned) {
      throw new Error(
        `Expected bundled ${packageName} ${pinned}, got ${bundledManifest.version}`,
      )
    }
    if (
      typeof bundledManifest.license !== "string" ||
      !bundledManifest.license
    ) {
      throw new Error(`Bundled ${packageName} declares no license`)
    }
    if (!shipsLicenseFile && !notices.includes(`\`${packageName}\``)) {
      throw new Error(
        `Bundled ${packageName} ships neither a LICENSE file nor a THIRD_PARTY_NOTICES.md entry`,
      )
    }
    const entryPrefix = `./node_modules/${packageName}/`
    const configuredEntries = new Set(
      manifest.pi.extensions.filter((entry) => entry.startsWith(entryPrefix)),
    )
    for (const entry of bundledManifest.pi?.extensions ?? []) {
      const registered = `${entryPrefix}${entry.replace(/^\.\//u, "")}`
      if (!configuredEntries.has(registered)) {
        throw new Error(
          `Aggregate does not register ${registered} declared by ${packageName}`,
        )
      }
    }
    for (const [dependency, range] of Object.entries(
      bundledManifest.dependencies ?? {},
    )) {
      if (hostPeerDependencies.includes(dependency)) continue
      const pinnedVersion = sourceManifest.dependencies?.[dependency]
      if (
        typeof pinnedVersion !== "string" ||
        !matchesPinnedRange(pinnedVersion, range)
      ) {
        throw new Error(
          `Expected promoted ${dependency}\`${range}\` for ${packageName}, got ${pinnedVersion}`,
        )
      }
    }
  }

  const extensionPaths = manifest.pi.extensions.map((entry) =>
    resolve(packageRoot, entry),
  )
  const skillPaths = manifest.pi.skills.map((entry) =>
    resolve(packageRoot, entry),
  )
  await Promise.all(
    [...extensionPaths, ...skillPaths].map((path) => stat(path)),
  )

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
  const { loadExtensions } = await import(pathToFileURL(loaderPath))
  beginPhase("extension-registration-and-contracts")
  const commandCodeModelsCache = join(stageDir, "commandcode-models.json")
  await writeFile(
    commandCodeModelsCache,
    `${JSON.stringify(
      {
        version: 2,
        models: [
          {
            id: "smoke-model",
            name: "Smoke Model (CC)",
            api: "openai-completions",
            reasoning: false,
            contextWindow: 8192,
            maxTokens: 1024,
          },
        ],
      },
      null,
      2,
    )}\n`,
  )
  // Bundled providers must load offline: pin their model catalogs and skip
  // their update checks so loading never reaches the network.
  const loaderEnv = {
    PI_PROVIDER_QODER_SKIP_UPDATE_CHECK: "1",
    COMMANDCODE_MODELS_URL: "http://127.0.0.1:9/models",
    COMMANDCODE_MODELS_CACHE: commandCodeModelsCache,
    COMMANDCODE_MODELS_TIMEOUT_MS: "200",
  }
  const clearedEnvNames = [
    "QODER_API_KEY",
    "QODER_PERSONAL_ACCESS_TOKEN",
    "QODER_PAT",
    "QODERCN_API_KEY",
    "QODERCN_PERSONAL_ACCESS_TOKEN",
    "QODERCN_PAT",
    "COMMAND_CODE_API_KEY",
    "COMMANDCODE_API_KEY",
  ]
  const previousEnv = new Map(
    [...Object.keys(loaderEnv), ...clearedEnvNames].map((name) => [
      name,
      process.env[name],
    ]),
  )
  for (const name of clearedEnvNames) delete process.env[name]
  Object.assign(process.env, loaderEnv)
  let result
  try {
    result = await loadExtensions(extensionPaths, installDir)
  } finally {
    for (const [name, value] of previousEnv) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
  if (result.errors.length > 0) {
    throw new Error(
      `Aggregate extension load failed:\n${JSON.stringify(result.errors, null, 2)}`,
    )
  }
  if (result.extensions.length !== extensionPaths.length) {
    throw new Error(
      `Loaded ${result.extensions.length} of ${extensionPaths.length} extensions`,
    )
  }

  // Registration evidence: the packed install mounts the tools and commands the
  // aggregate promises. Deeper behavior lives in each package's own tests.
  const requiredRegistrations = [
    ["@herbertgao/pi-agency/src/index.ts", "tools", "agency_search"],
    ["@herbertgao/pi-agency/src/index.ts", "tools", "agency_dispatch"],
    ["@tifan/pi-copy-response/src/index.ts", "commands", "copy-response"],
    ["@tifan/pi-handoff/src/index.ts", "commands", "__pi-handoff-session"],
    ["@tifan/pi-handoff/src/session-query.ts", "tools", "session_query"],
    ["@tifan/pi-mermaid-open/src/index.ts", "commands", "mermaid-open"],
    ["@tifan/pi-recap/src/index.ts", "commands", "recap"],
    ["@tifan/pi-rename/src/index.ts", "commands", "rename"],
    ["@tintinweb/pi-tasks/src/index.ts", "tools", "TaskCreate"],
    ["@tintinweb/pi-tasks/src/index.ts", "tools", "TaskList"],
    ["@tintinweb/pi-tasks/src/index.ts", "tools", "TaskGet"],
    ["@tintinweb/pi-tasks/src/index.ts", "tools", "TaskUpdate"],
    ["@tintinweb/pi-tasks/src/index.ts", "tools", "TaskOutput"],
    ["@tintinweb/pi-tasks/src/index.ts", "tools", "TaskStop"],
    ["@tintinweb/pi-tasks/src/index.ts", "tools", "TaskExecute"],
    ["@tintinweb/pi-tasks/src/index.ts", "commands", "tasks"],
    ["@narumitw/pi-btw/dist/index.ts", "commands", "btw"],
    ["@narumitw/pi-caffeinate/dist/index.ts", "commands", "caffeinate"],
    ["pi-lens/dist/index.js", "tools", "lens_diagnostics"],
    ["pi-lens/dist/index.js", "tools", "pi_lens_activate_tools"],
    ["pi-lens/dist/index.js", "commands", "lens-widget-toggle"],
    ["pi-antigravity/src/features/google-search.ts", "tools", "google_search"],
    [
      "pi-antigravity/src/features/read-url-content.ts",
      "tools",
      "read_url_content",
    ],
    [
      "pi-antigravity/src/features/generate-image.ts",
      "tools",
      "generate_image",
    ],
    ["pi-provider-qoder/dist/index.js", "commands", "qoder-usage"],
    ["pi-typesafe/extensions/index.js", "commands", "typesafe"],
    ["pi-typesafe/extensions/index.js", "tools", "typesafe_evaluate"],
    ["pi-commandcode-provider/index.ts", "commands", "commandcode-quota"],
    ["pi-commandcode-provider/index.ts", "commands", "commandcode-refresh"],
    ["pi-commandcode-provider/index.ts", "commands", "commandcode-status"],
    ["pi-commandcode-provider/index.ts", "commands", "commandcode-endpoint"],
    ["pi-commandcode-provider/index.ts", "commands", "commandcode-diagnostics"],
  ]
  for (const [relativePath, registry, name] of requiredRegistrations) {
    const entry = resolve(packageRoot, "node_modules", relativePath)
    const loaded = result.extensions.find(
      (extension) => extension.resolvedPath === entry,
    )
    if (!loaded?.[registry].has(name)) {
      throw new Error(`Packed ${relativePath} did not register ${name}`)
    }
  }
  const qoderEntry = resolve(
    packageRoot,
    "node_modules/pi-provider-qoder/dist/index.js",
  )
  const qoderProviders = result.runtime.pendingProviderRegistrations
    .filter((registration) => registration.extensionPath === qoderEntry)
    .map((registration) => registration.name)
    .toSorted()
  if (
    JSON.stringify(qoderProviders) !== JSON.stringify(["qoder", "qoder-cn"])
  ) {
    throw new Error(
      `Expected qoder and qoder-cn providers, got ${qoderProviders.join(", ")}`,
    )
  }
  const solPiEntry = resolve(
    packageRoot,
    "node_modules",
    "@herbertgao",
    "sol-pi",
    "src",
    "sol-pi",
    "index.ts",
  )
  const loadedSolPi = result.extensions.find(
    (extension) => extension.resolvedPath === solPiEntry,
  )
  if (!loadedSolPi?.handlers.has("session_start")) {
    throw new Error("Packed SoL-Pi did not register its session_start handler")
  }

  beginPhase("runtime-smokes")
  const webAccessEntry = resolve(
    packageRoot,
    "node_modules",
    "pi-web-access",
    "dist",
  )
  if (!extensionPaths.includes(webAccessEntry)) {
    throw new Error(
      "Packed aggregate is missing the pi-web-access extension entry",
    )
  }
  await runPiWebAccessRealSmoke({ webAccessEntry })

  beginPhase("bundle-contracts")
  const bundled = new Set(packed.bundled)
  const missingBundles = manifest.bundledDependencies.filter(
    (name) => !bundled.has(name),
  )
  if (missingBundles.length > 0) {
    throw new Error(`Missing bundled packages: ${missingBundles.join(", ")}`)
  }
  if (bundled.has("@narumitw/pi-tui-kit")) {
    throw new Error("pi-tui-kit must remain an unbundled runtime dependency")
  }
  if (manifest.pi.extensions.some((entry) => entry.includes("pi-tui-kit"))) {
    throw new Error(
      "pi-tui-kit editor status helpers must stay unregistered aggregate extensions",
    )
  }
  if (bundled.has("undici")) {
    throw new Error("undici must remain an unbundled runtime dependency")
  }
  for (const dependency of [
    "@effect/platform-node",
    "@effect/platform-node-shared",
    "effect",
  ]) {
    if (bundled.has(dependency)) {
      throw new Error(
        `${dependency} must remain an unbundled runtime dependency`,
      )
    }
  }
  if (bundled.size !== manifest.bundledDependencies.length) {
    throw new Error(
      "Transitive dependencies must remain unbundled for platform portability",
    )
  }
  if (packed.files.some((file) => file.path.includes("/test/"))) {
    throw new Error("Aggregate tarball unexpectedly contains child test files")
  }

  await cleanupLoadedExtensions()
  finishPhase("passed")
  process.stdout.write(
    `Aggregate smoke passed: ${result.extensions.length} extensions, ` +
      `${bundled.size} bundled dependencies\n`,
  )
} catch (error) {
  finishPhase("failed", error)
  await preserveFailureArtifact(error)
  throw error
} finally {
  await cleanupLoadedExtensions()
  await rm(stageDir, { recursive: true, force: true })
}
