import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  findPublishedManifestDrift,
  parseJson,
  parseNpmPackOutput,
} from "./npm-pack-json.mjs"
import { runPiAutomodeRealSmoke } from "./pi-automode-real-smoke.mjs"
import { runPiWebAccessRealSmoke } from "./pi-web-access-real-smoke.mjs"
import { runRemotePiRealSmoke } from "./remote-pi-real-smoke.mjs"
import { run } from "./process.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const aggregateDir = join(root, "packages", "pi-extensions")

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === "ENOENT") return false
    throw error
  }
}

const stageDir = await mkdtemp(join(tmpdir(), "pi-extensions-smoke-"))
try {
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
  const tarballPath = join(stageDir, packed.filename)
  const installDir = join(stageDir, "install")
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefix",
      installDir,
      tarballPath,
    ],
    { cwd: stageDir },
  )

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

  const automodeRoot = join(
    packageRoot,
    "node_modules",
    "@czottmann",
    "pi-automode",
  )
  const automodeManifestPath = join(automodeRoot, "package.json")
  const automodeManifest = parseJson(
    await readFile(automodeManifestPath, "utf8"),
    automodeManifestPath,
  )
  const expectedAutomodeVersion =
    sourceManifest.dependencies["@czottmann/pi-automode"]
  if (automodeManifest.version !== expectedAutomodeVersion) {
    throw new Error(
      `Expected bundled pi-automode ${expectedAutomodeVersion}, got ${automodeManifest.version}`,
    )
  }
  if (automodeManifest.license !== "MIT") {
    throw new Error(
      `Expected pi-automode MIT license, got ${automodeManifest.license}`,
    )
  }
  const automodeEntryRelative = "./extensions/auto-mode.ts"
  if (!automodeManifest.pi?.extensions?.includes(automodeEntryRelative)) {
    throw new Error(
      "Bundled pi-automode no longer declares its expected Pi entry",
    )
  }
  const automodeLicense = await readFile(
    join(automodeRoot, "LICENSE.md"),
    "utf8",
  )
  if (!automodeLicense.startsWith("# MIT License")) {
    throw new Error(
      "Bundled pi-automode LICENSE.md is not the expected MIT text",
    )
  }

  const mcpRoot = join(packageRoot, "node_modules", "pi-mcp-adapter")
  const mcpManifestPath = join(mcpRoot, "package.json")
  const mcpManifest = parseJson(
    await readFile(mcpManifestPath, "utf8"),
    mcpManifestPath,
  )
  const expectedMcpVersion = sourceManifest.dependencies["pi-mcp-adapter"]
  if (mcpManifest.version !== expectedMcpVersion) {
    throw new Error(
      `Expected bundled pi-mcp-adapter ${expectedMcpVersion}, got ${mcpManifest.version}`,
    )
  }
  if (mcpManifest.license !== "MIT") {
    throw new Error(
      `Expected pi-mcp-adapter MIT license, got ${mcpManifest.license}`,
    )
  }
  const mcpLicense = await readFile(join(mcpRoot, "LICENSE"), "utf8")
  if (!mcpLicense.startsWith("MIT License")) {
    throw new Error(
      "Bundled pi-mcp-adapter LICENSE is not the expected MIT text",
    )
  }
  const mcpEntryRelative = "./index.ts"
  const mcpSkillsRelative = "./skills"
  if (!mcpManifest.pi?.extensions?.includes(mcpEntryRelative)) {
    throw new Error(
      "Bundled pi-mcp-adapter no longer declares its expected Pi entry",
    )
  }
  if (!mcpManifest.pi?.skills?.includes(mcpSkillsRelative)) {
    throw new Error(
      "Bundled pi-mcp-adapter no longer declares its expected skills",
    )
  }
  if (mcpManifest.exports?.["./oauth"]?.import !== "./oauth.ts") {
    throw new Error(
      "Bundled pi-mcp-adapter no longer exports its OAuth public API",
    )
  }
  if (mcpManifest.bin?.["pi-mcp-adapter"] !== "cli.js") {
    throw new Error("Bundled pi-mcp-adapter no longer declares its CLI")
  }
  for (const [dependency, range] of Object.entries(
    mcpManifest.dependencies ?? {},
  )) {
    if (sourceManifest.dependencies[dependency] !== range) {
      throw new Error(
        `Expected pi-mcp-adapter dependency ${dependency}@${range}, got ${sourceManifest.dependencies[dependency]}`,
      )
    }
  }

  const webAccessRoot = join(packageRoot, "node_modules", "pi-web-access")
  const webAccessManifestPath = join(webAccessRoot, "package.json")
  const webAccessManifest = parseJson(
    await readFile(webAccessManifestPath, "utf8"),
    webAccessManifestPath,
  )
  const expectedWebAccessVersion = sourceManifest.dependencies["pi-web-access"]
  if (webAccessManifest.version !== expectedWebAccessVersion) {
    throw new Error(
      `Expected bundled pi-web-access ${expectedWebAccessVersion}, got ${webAccessManifest.version}`,
    )
  }
  if (webAccessManifest.license !== "MIT") {
    throw new Error(
      `Expected pi-web-access MIT license, got ${webAccessManifest.license}`,
    )
  }
  const webAccessLicense = await readFile(
    join(webAccessRoot, "LICENSE"),
    "utf8",
  )
  if (!webAccessLicense.startsWith("MIT License")) {
    throw new Error(
      "Bundled pi-web-access LICENSE is not the expected MIT text",
    )
  }
  const webAccessEntryRelative = "./index.ts"
  if (!webAccessManifest.pi?.extensions?.includes(webAccessEntryRelative)) {
    throw new Error(
      "Bundled pi-web-access no longer declares its expected Pi entry",
    )
  }
  const expectedUndiciRange = webAccessManifest.dependencies?.undici
  if (
    !expectedUndiciRange ||
    sourceManifest.dependencies.undici !== expectedUndiciRange
  ) {
    throw new Error(
      `Expected promoted undici dependency ${expectedUndiciRange}, got ${sourceManifest.dependencies.undici}`,
    )
  }

  const btwRoot = join(packageRoot, "node_modules", "@narumitw", "pi-btw")
  const btwManifestPath = join(btwRoot, "package.json")
  const btwManifest = parseJson(
    await readFile(btwManifestPath, "utf8"),
    btwManifestPath,
  )
  const expectedBtwVersion = sourceManifest.dependencies["@narumitw/pi-btw"]
  if (btwManifest.version !== expectedBtwVersion) {
    throw new Error(
      `Expected bundled pi-btw ${expectedBtwVersion}, got ${btwManifest.version}`,
    )
  }
  if (btwManifest.license !== "MIT") {
    throw new Error(`Expected pi-btw MIT license, got ${btwManifest.license}`)
  }
  const btwEntryRelative = "./src/index.ts"
  if (!btwManifest.pi?.extensions?.includes(btwEntryRelative)) {
    throw new Error("Bundled pi-btw no longer declares its expected Pi entry")
  }
  const expectedTuiKitRange = btwManifest.dependencies?.["@narumitw/pi-tui-kit"]
  if (
    sourceManifest.dependencies["@narumitw/pi-tui-kit"] !== expectedTuiKitRange
  ) {
    throw new Error(
      `Expected pi-tui-kit dependency ${expectedTuiKitRange}, got ${sourceManifest.dependencies["@narumitw/pi-tui-kit"]}`,
    )
  }

  const ponytailRoot = join(
    packageRoot,
    "node_modules",
    "@dietrichgebert",
    "ponytail",
  )
  const ponytailManifestPath = join(ponytailRoot, "package.json")
  const ponytailManifest = parseJson(
    await readFile(ponytailManifestPath, "utf8"),
    ponytailManifestPath,
  )
  const expectedPonytailVersion =
    sourceManifest.dependencies["@dietrichgebert/ponytail"]
  if (ponytailManifest.version !== expectedPonytailVersion) {
    throw new Error(
      `Expected bundled ponytail ${expectedPonytailVersion}, got ${ponytailManifest.version}`,
    )
  }
  if (ponytailManifest.license !== "MIT") {
    throw new Error(
      `Expected ponytail MIT license, got ${ponytailManifest.license}`,
    )
  }
  const ponytailEntryRelative = "./pi-extension/index.js"
  const ponytailSkillsRelative = "./skills"
  if (!ponytailManifest.pi?.extensions?.includes(ponytailEntryRelative)) {
    throw new Error(
      "Bundled ponytail no longer declares its expected Pi extension",
    )
  }
  if (!ponytailManifest.pi?.skills?.includes(ponytailSkillsRelative)) {
    throw new Error("Bundled ponytail no longer declares its expected skills")
  }

  const fastModeRoot = join(
    packageRoot,
    "node_modules",
    "@pi-plugins",
    "fast-mode",
  )
  const fastModeManifestPath = join(fastModeRoot, "package.json")
  const fastModeManifest = parseJson(
    await readFile(fastModeManifestPath, "utf8"),
    fastModeManifestPath,
  )
  const expectedFastModeVersion =
    sourceManifest.dependencies["@pi-plugins/fast-mode"]
  if (fastModeManifest.version !== expectedFastModeVersion) {
    throw new Error(
      `Expected bundled fast-mode ${expectedFastModeVersion}, got ${fastModeManifest.version}`,
    )
  }
  if (fastModeManifest.license !== "MIT") {
    throw new Error(
      `Expected fast-mode MIT license, got ${fastModeManifest.license}`,
    )
  }
  const fastModeEntryRelative = "./dist/index.mjs"
  if (!fastModeManifest.pi?.extensions?.includes(fastModeEntryRelative)) {
    throw new Error(
      "Bundled fast-mode no longer declares its expected Pi entry",
    )
  }
  for (const [dependency, range] of Object.entries(
    fastModeManifest.dependencies ?? {},
  )) {
    if (sourceManifest.dependencies[dependency] !== range) {
      throw new Error(
        `Expected fast-mode dependency ${dependency}@${range}, got ${sourceManifest.dependencies[dependency]}`,
      )
    }
  }
  const expectedEffectVersion = fastModeManifest.dependencies.effect
  if (
    sourceManifest.dependencies["@effect/platform-node-shared"] !==
    expectedEffectVersion
  ) {
    throw new Error(
      `Expected platform-node-shared compatibility pin ${expectedEffectVersion}, got ${sourceManifest.dependencies["@effect/platform-node-shared"]}`,
    )
  }

  const remotePiRoot = join(packageRoot, "node_modules", "remote-pi")
  const remotePiManifestPath = join(remotePiRoot, "package.json")
  const remotePiManifest = parseJson(
    await readFile(remotePiManifestPath, "utf8"),
    remotePiManifestPath,
  )
  const expectedRemotePiVersion = sourceManifest.dependencies["remote-pi"]
  if (remotePiManifest.version !== expectedRemotePiVersion) {
    throw new Error(
      `Expected bundled remote-pi ${expectedRemotePiVersion}, got ${remotePiManifest.version}`,
    )
  }
  if (remotePiManifest.license !== "MIT") {
    throw new Error(
      `Expected remote-pi MIT license, got ${remotePiManifest.license}`,
    )
  }
  if (!remotePiManifest.pi?.extensions?.includes("./dist")) {
    throw new Error("Bundled remote-pi no longer declares its dist Pi entry")
  }
  if (
    remotePiManifest.bin?.["remote-pi"] !== "dist/index.js" ||
    remotePiManifest.bin?.["pi-supervisord"] !== "dist/bin/supervisord.js"
  ) {
    throw new Error("Bundled remote-pi no longer declares its expected CLIs")
  }
  const zodManifestPath =
    createRequire(remotePiManifestPath).resolve("zod/package.json")
  const zodManifest = parseJson(
    await readFile(zodManifestPath, "utf8"),
    zodManifestPath,
  )
  const [zodMajor, zodMinor, zodPatch] = zodManifest.version
    .split(".")
    .map(Number)
  if (zodMajor !== 4 || zodMinor < 4 || (zodMinor === 4 && zodPatch < 3)) {
    throw new Error(
      `Expected remote-pi-compatible zod 4.4.3+, got ${zodManifest.version}`,
    )
  }
  for (const [dependency, range] of Object.entries(
    remotePiManifest.dependencies ?? {},
  )) {
    if (
      dependency !== "zod" &&
      sourceManifest.dependencies[dependency] !== range
    ) {
      throw new Error(
        `Expected remote-pi dependency ${dependency}@${range}, got ${sourceManifest.dependencies[dependency]}`,
      )
    }
  }
  const hostDependencies = [
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
  ]
  const nestedHosts = await Promise.all(
    hostDependencies.map((hostDependency) =>
      pathExists(
        join(remotePiRoot, "node_modules", ...hostDependency.split("/")),
      ),
    ),
  )
  for (const [index, hostDependency] of hostDependencies.entries()) {
    if (remotePiManifest.dependencies?.[hostDependency]) {
      throw new Error(
        `Bundled remote-pi must use the aggregate ${hostDependency} host`,
      )
    }
    if (nestedHosts[index]) {
      throw new Error(`Bundled remote-pi contains a nested ${hostDependency}`)
    }
  }
  if (
    sourceManifest.dependencies["@earendil-works/pi-coding-agent"] !==
      "^0.84.1" ||
    sourceManifest.dependencies["@earendil-works/pi-tui"] !== "^0.84.1"
  ) {
    throw new Error("Aggregate remote-pi hosts must remain on Pi 0.84.1+")
  }
  const installedHosts = await Promise.all(
    ["@earendil-works/pi-coding-agent", "@earendil-works/pi-tui"].map(
      async (hostDependency) => {
        const hostManifestPath = join(
          installDir,
          "node_modules",
          ...hostDependency.split("/"),
          "package.json",
        )
        const hostManifest = parseJson(
          await readFile(hostManifestPath, "utf8"),
          hostManifestPath,
        )
        return { hostDependency, version: hostManifest.version }
      },
    ),
  )
  for (const { hostDependency, version } of installedHosts) {
    if (version !== "0.84.1") {
      throw new Error(
        `Expected remote-pi ${hostDependency} host 0.84.1, got ${version}`,
      )
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
  await Promise.all(
    [
      "node_modules/@dietrichgebert/ponytail/LICENSE",
      "node_modules/@juicesharp/rpiv-ask-user-question/LICENSE",
      "node_modules/@narumitw/pi-btw/LICENSE",
      "node_modules/@pi-plugins/fast-mode/LICENSE",
      "node_modules/pi-lens/LICENSE",
      "node_modules/pi-mcp-adapter/LICENSE",
      "node_modules/pi-web-access/LICENSE",
      "node_modules/remote-pi/LICENSE",
      "node_modules/remote-pi/service-templates/launchd.plist.template",
      "node_modules/remote-pi/service-templates/systemd.service.template",
      "node_modules/remote-pi/service-templates/task-launcher.vbs.template",
      "node_modules/remote-pi/service-templates/task-scheduler.xml.template",
    ].map((path) => stat(join(packageRoot, path))),
  )
  await Promise.all(
    [
      "ponytail",
      "ponytail-audit",
      "ponytail-debt",
      "ponytail-gain",
      "ponytail-help",
      "ponytail-review",
    ].map((name) => stat(join(ponytailRoot, "skills", name, "SKILL.md"))),
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
  const result = await loadExtensions(extensionPaths, installDir)
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

  const automodeEntry = resolve(automodeRoot, automodeEntryRelative)
  if (!extensionPaths.includes(automodeEntry)) {
    throw new Error(
      "Packed aggregate is missing the pi-automode extension entry",
    )
  }
  await runPiAutomodeRealSmoke({ automodeEntry })

  const mcpEntry = resolve(mcpRoot, mcpEntryRelative)
  if (!extensionPaths.includes(mcpEntry)) {
    throw new Error(
      "Packed aggregate is missing the pi-mcp-adapter extension entry",
    )
  }
  const mcpSkills = resolve(mcpRoot, mcpSkillsRelative)
  if (!skillPaths.includes(mcpSkills)) {
    throw new Error("Packed aggregate is missing the pi-mcp-adapter skills")
  }
  const mcpOAuthEntry = resolve(mcpRoot, "oauth.ts")
  await Promise.all([stat(mcpOAuthEntry), stat(join(mcpRoot, "cli.js"))])
  const previousAuthStore = process.env.PI_MCP_ADAPTER_TEST_AUTH_STORE
  process.env.PI_MCP_ADAPTER_TEST_AUTH_STORE = "memory"
  try {
    const require = createRequire(mcpOAuthEntry)
    const { createJiti } = await import(pathToFileURL(require.resolve("jiti")))
    const jiti = createJiti(mcpOAuthEntry, { moduleCache: false })
    const oauth = await jiti.import(mcpOAuthEntry)
    const serverName = "aggregate-smoke"
    const serverUrl = "https://mcp.example.test/server"
    const tokens = { accessToken: "smoke-token" }
    oauth.updateMcpOAuthTokensForUrl(serverName, serverUrl, tokens)
    const present = oauth.inspectMcpOAuthTokensForUrl(serverName, serverUrl)
    if (
      present.status !== "present" ||
      present.tokens.accessToken !== tokens.accessToken
    ) {
      throw new Error("pi-mcp-adapter OAuth token reuse failed")
    }
    const mismatched = oauth.inspectMcpOAuthTokensForUrl(
      serverName,
      "https://other.example.test/server",
    )
    if (mismatched.status !== "absent") {
      throw new Error("pi-mcp-adapter OAuth tokens were not URL-bound")
    }
  } finally {
    if (previousAuthStore === undefined) {
      delete process.env.PI_MCP_ADAPTER_TEST_AUTH_STORE
    } else {
      process.env.PI_MCP_ADAPTER_TEST_AUTH_STORE = previousAuthStore
    }
  }

  const webAccessEntry = resolve(webAccessRoot, webAccessEntryRelative)
  if (!extensionPaths.includes(webAccessEntry)) {
    throw new Error(
      "Packed aggregate is missing the pi-web-access extension entry",
    )
  }
  await runPiWebAccessRealSmoke({ webAccessEntry })

  const btwEntry = resolve(btwRoot, btwEntryRelative)
  if (!extensionPaths.includes(btwEntry)) {
    throw new Error("Packed aggregate is missing the pi-btw extension entry")
  }
  const ponytailEntry = resolve(ponytailRoot, ponytailEntryRelative)
  if (!extensionPaths.includes(ponytailEntry)) {
    throw new Error("Packed aggregate is missing the ponytail extension entry")
  }
  const ponytailSkills = resolve(ponytailRoot, ponytailSkillsRelative)
  if (!skillPaths.includes(ponytailSkills)) {
    throw new Error("Packed aggregate is missing the ponytail skills")
  }
  const fastModeEntry = resolve(fastModeRoot, fastModeEntryRelative)
  if (!extensionPaths.includes(fastModeEntry)) {
    throw new Error("Packed aggregate is missing the fast-mode extension entry")
  }
  const remotePiEntry = resolve(remotePiRoot, "dist/index.js")
  if (!extensionPaths.includes(remotePiEntry)) {
    throw new Error("Packed aggregate is missing the remote-pi extension entry")
  }
  const remotePiSkills = resolve(remotePiRoot, "skills")
  if (!skillPaths.includes(remotePiSkills)) {
    throw new Error("Packed aggregate is missing the remote-pi skills")
  }
  const remotePiLicense = await readFile(join(remotePiRoot, "LICENSE"), "utf8")
  if (
    !remotePiLicense.startsWith("MIT License\n\nCopyright (c) 2026 Jacob Moura")
  ) {
    throw new Error("Bundled remote-pi LICENSE is not the expected MIT text")
  }
  const remotePiSkill = await readFile(
    join(remotePiSkills, "agent-network", "SKILL.md"),
    "utf8",
  )
  if (!remotePiSkill.startsWith("---\nname: agent-network\n")) {
    throw new Error("Bundled remote-pi agent-network skill is invalid")
  }
  await runRemotePiRealSmoke({ remotePiEntry })

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

  process.stdout.write(
    `Aggregate smoke passed: ${result.extensions.length} extensions, ` +
      `${bundled.size} bundled dependencies\n`,
  )
} finally {
  await rm(stageDir, { recursive: true, force: true })
}
