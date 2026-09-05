import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
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
  const automodeSkillsRelative = "./skills"
  if (!automodeManifest.pi?.skills?.includes(automodeSkillsRelative)) {
    throw new Error("Bundled pi-automode no longer declares its skills")
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
  const expectedUnbashVersion = automodeManifest.dependencies?.unbash
  if (
    !expectedUnbashVersion ||
    sourceManifest.dependencies.unbash !== expectedUnbashVersion
  ) {
    throw new Error(
      `Expected promoted unbash dependency ${expectedUnbashVersion}, got ${sourceManifest.dependencies.unbash}`,
    )
  }

  const hindsightRoot = join(
    packageRoot,
    "node_modules",
    "@luxusai",
    "pi-hindsight",
  )
  const hindsightManifestPath = join(hindsightRoot, "package.json")
  const hindsightManifest = parseJson(
    await readFile(hindsightManifestPath, "utf8"),
    hindsightManifestPath,
  )
  const expectedHindsightVersion =
    sourceManifest.dependencies["@luxusai/pi-hindsight"]
  if (
    hindsightManifest.name !== "@luxusai/pi-hindsight" ||
    hindsightManifest.version !== expectedHindsightVersion ||
    hindsightManifest.license !== "MIT" ||
    !hindsightManifest.pi?.extensions?.includes("./extensions") ||
    !hindsightManifest.pi?.skills?.includes("./skills")
  ) {
    throw new Error(
      "Bundled @luxusai/pi-hindsight does not match its pinned MIT Pi package contract",
    )
  }

  const footerRoot = join(packageRoot, "node_modules", "pi-footer")
  const footerManifestPath = join(footerRoot, "package.json")
  const footerManifest = parseJson(
    await readFile(footerManifestPath, "utf8"),
    footerManifestPath,
  )
  const expectedFooterVersion = sourceManifest.dependencies["pi-footer"]
  if (footerManifest.version !== expectedFooterVersion) {
    throw new Error(
      `Expected bundled pi-footer ${expectedFooterVersion}, got ${footerManifest.version}`,
    )
  }
  if (footerManifest.license !== "MIT") {
    throw new Error(
      `Expected pi-footer MIT license, got ${footerManifest.license}`,
    )
  }
  const footerEntryRelative = "./src/index.ts"
  if (!footerManifest.pi?.extensions?.includes(footerEntryRelative)) {
    throw new Error(
      "Bundled pi-footer no longer declares its expected Pi entry",
    )
  }
  const footerLicense = await readFile(join(footerRoot, "LICENSE"), "utf8")
  if (!footerLicense.startsWith("MIT License\n\nCopyright (c) 2026 wobondar")) {
    throw new Error("Bundled pi-footer LICENSE is not the expected MIT text")
  }
  for (const [dependency, range] of Object.entries(
    footerManifest.dependencies ?? {},
  )) {
    if (sourceManifest.dependencies[dependency] !== range) {
      throw new Error(
        `Expected pi-footer dependency ${dependency}@${range}, got ${sourceManifest.dependencies[dependency]}`,
      )
    }
  }

  const footerExamplePath = join(packageRoot, "examples", "pi-footer.json")
  const footerExample = parseJson(
    await readFile(footerExamplePath, "utf8"),
    footerExamplePath,
  )
  if (
    footerExample.separator !== "dot" ||
    footerExample.separatorFg !== "brightBlack"
  ) {
    throw new Error(
      "Recommended pi-footer config must use a gray dot separator",
    )
  }
  const footerRequire = createRequire(join(footerRoot, footerEntryRelative))
  const { createJiti: createFooterJiti } = await import(
    pathToFileURL(footerRequire.resolve("jiti"))
  )
  const footerJiti = createFooterJiti(footerExamplePath, {
    moduleCache: false,
  })
  const footerConfigModule = await footerJiti.import(
    join(footerRoot, "src", "config.ts"),
  )
  const normalizedFooter = footerConfigModule.normalizeConfig(footerExample)
  if (
    normalizedFooter.separator !== "dot" ||
    normalizedFooter.separatorFg !== "brightBlack"
  ) {
    throw new Error(
      "Recommended pi-footer separator changed during normalization",
    )
  }
  const footerStoreModule = await footerJiti.import(
    join(footerRoot, "src", "widgets", "store.ts"),
  )
  footerStoreModule.WidgetStore.fromConfig(normalizedFooter)
  const configuredStatusKeys = new Set(
    normalizedFooter.lines
      .flat()
      .filter((widget) => widget.type === "external-status")
      .map((widget) => widget.options.externalStatusKey),
  )
  const expectedStatusKeys = [
    "mcp",
    "pi-automode",
    "pi-lens-lsp",
    "ponytail",
    "remote-pi:peer-active",
    "remote-pi:relay",
    "remote-pi:session",
    "subagents",
  ]
  for (const statusKey of expectedStatusKeys) {
    if (
      !configuredStatusKeys.has(statusKey) ||
      !normalizedFooter.extensionStatusRow.hiddenKeys.includes(statusKey) ||
      !normalizedFooter.extensionStatusRow.knownKeys.includes(statusKey)
    ) {
      throw new Error(
        `Recommended pi-footer config does not own status ${statusKey}`,
      )
    }
  }

  const askRoot = join(
    packageRoot,
    "node_modules",
    "@juicesharp",
    "rpiv-ask-user-question",
  )
  const askManifestPath = join(askRoot, "package.json")
  const askManifest = parseJson(
    await readFile(askManifestPath, "utf8"),
    askManifestPath,
  )
  const expectedAskVersion =
    sourceManifest.dependencies["@juicesharp/rpiv-ask-user-question"]
  if (askManifest.version !== expectedAskVersion) {
    throw new Error(
      `Expected bundled ask-user-question ${expectedAskVersion}, got ${askManifest.version}`,
    )
  }
  if (askManifest.license !== "MIT") {
    throw new Error(
      `Expected ask-user-question MIT license, got ${askManifest.license}`,
    )
  }
  const askEntryRelative = "./index.ts"
  if (!askManifest.pi?.extensions?.includes(askEntryRelative)) {
    throw new Error(
      "Bundled ask-user-question no longer declares its expected Pi entry",
    )
  }
  const expectedConfigRange =
    askManifest.dependencies?.["@juicesharp/rpiv-config"]
  if (
    !expectedConfigRange ||
    sourceManifest.dependencies["@juicesharp/rpiv-config"] !==
      expectedConfigRange
  ) {
    throw new Error(
      `Expected promoted rpiv-config ${expectedConfigRange}, got ${sourceManifest.dependencies["@juicesharp/rpiv-config"]}`,
    )
  }

  const lensRoot = join(packageRoot, "node_modules", "pi-lens")
  const lensManifestPath = join(lensRoot, "package.json")
  const lensManifest = parseJson(
    await readFile(lensManifestPath, "utf8"),
    lensManifestPath,
  )
  const expectedLensVersion = sourceManifest.dependencies["pi-lens"]
  if (lensManifest.version !== expectedLensVersion) {
    throw new Error(
      `Expected bundled pi-lens ${expectedLensVersion}, got ${lensManifest.version}`,
    )
  }
  if (lensManifest.license !== "MIT") {
    throw new Error(`Expected pi-lens MIT license, got ${lensManifest.license}`)
  }
  if (
    JSON.stringify(lensManifest.pi?.extensions) !==
    JSON.stringify(["./dist/index.js"])
  ) {
    throw new Error("Bundled pi-lens no longer declares its expected Pi entry")
  }
  if (
    JSON.stringify(lensManifest.pi?.skills) !== JSON.stringify(["../../skills"])
  ) {
    throw new Error("Bundled pi-lens no longer declares its skills")
  }
  const expectedLensBins = {
    "pi-lens": "dist/mcp/cli.js",
    "pi-lens-mcp": "dist/mcp/server.js",
    "pi-lens-analyze": "dist/mcp/analyze-cli.js",
  }
  if (JSON.stringify(lensManifest.bin) !== JSON.stringify(expectedLensBins)) {
    throw new Error("Bundled pi-lens no longer declares its three CLIs")
  }
  const expectedLensPeers = {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "^0.84.1",
    typebox: "^1.0.0",
  }
  for (const [dependency, range] of Object.entries(expectedLensPeers)) {
    if (
      lensManifest.peerDependencies?.[dependency] !== range ||
      lensManifest.peerDependenciesMeta?.[dependency]?.optional !== true ||
      lensManifest.dependencies?.[dependency]
    ) {
      throw new Error(
        `Expected pi-lens optional peer ${dependency}@${range} outside runtime dependencies`,
      )
    }
  }
  const lensJitiRange = lensManifest.optionalDependencies?.jiti
  if (
    lensJitiRange !== "^2.7.0" ||
    sourceManifest.dependencies.jiti !== lensJitiRange
  ) {
    throw new Error(
      `Expected aggregate jiti host for pi-lens ${lensJitiRange}, got ${sourceManifest.dependencies.jiti}`,
    )
  }
  if (
    sourceManifest.dependencies["@earendil-works/pi-tui"] !== "^0.84.4" ||
    sourceManifest.dependencies.typebox !== "^1.1.38"
  ) {
    throw new Error("Aggregate pi-lens host ranges are no longer compatible")
  }
  const lensHosts = Object.keys(expectedLensPeers)
  const nestedLensHosts = await Promise.all(
    lensHosts.map((dependency) =>
      pathExists(join(lensRoot, "node_modules", ...dependency.split("/"))),
    ),
  )
  for (const [index, dependency] of lensHosts.entries()) {
    if (nestedLensHosts[index]) {
      throw new Error(`Bundled pi-lens contains a nested ${dependency} host`)
    }
  }
  // Keep pi-lens' minimatch range exact; the aggregate already provides its
  // compatible Pi TUI, typebox, and jiti hosts.
  const lensMinimatchRange = lensManifest.dependencies?.minimatch
  if (
    !lensMinimatchRange ||
    sourceManifest.dependencies.minimatch !== lensMinimatchRange
  ) {
    throw new Error(
      `Expected promoted pi-lens dependency minimatch@${lensMinimatchRange}, got ${sourceManifest.dependencies.minimatch}`,
    )
  }
  const expectedLensSkillGroups = [
    "pi-lens-ast-grep",
    "pi-lens-lsp-navigation",
    "pi-lens-write-ast-grep-rule",
    "pi-lens-write-tree-sitter-rule",
  ]
  const lensSkillGroups = (
    await readdir(join(lensRoot, "skills"), {
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()
  if (
    JSON.stringify(lensSkillGroups) !== JSON.stringify(expectedLensSkillGroups)
  ) {
    throw new Error(
      `Expected four pi-lens skill groups, got ${lensSkillGroups.join(", ")}`,
    )
  }
  await Promise.all(
    [
      "dist/index.js",
      "dist/tools",
      "dist/clients/dispatch/runners/cue-vet.js",
      "dist/clients/dispatch/runners/helm-render.js",
      "dist/clients/dispatch/runners/utils/toolchain-availability.js",
      "vendor/grammars/tree-sitter-cue.wasm",
      ...expectedLensSkillGroups.map((group) => `skills/${group}/SKILL.md`),
      "skills/pi-lens-write-ast-grep-rule/reference.md",
      "LICENSE",
    ].map((path) => stat(join(lensRoot, path))),
  )

  const astGrepNapi = await import(
    pathToFileURL(
      join(lensRoot, "dist/clients/dispatch/runners/ast-grep-napi.js"),
    )
  )
  for (const [file, language] of [
    ["style.css", "css"],
    ["page.html", "html"],
    ["page.htm", "html"],
  ]) {
    if (
      !astGrepNapi.canHandle(file) ||
      astGrepNapi.ruleLanguageForFile(file) !== language ||
      astGrepNapi.AST_GREP_LSP_ONLY_RULE_LANGUAGES.includes(language)
    ) {
      throw new Error(`pi-lens lost NAPI ${language} routing for ${file}`)
    }
  }
  await Promise.all(
    [
      "rules/ast-grep-rules/rules/no-important.yml",
      "rules/ast-grep-rules/rule-tests/no-important-test.yml",
    ].map((path) => stat(join(lensRoot, path))),
  )
  const lensFileKinds = await import(
    pathToFileURL(join(lensRoot, "dist/clients/file-kinds.js"))
  )
  const sgModule = await astGrepNapi.loadSg()
  for (const [file, source, expectedMessage] of [
    ["smoke.css", ".button { color: red !important; }", "!important"],
    ["smoke.html", "<main><h1>Smoke</h1></main>", undefined],
  ]) {
    const language = astGrepNapi.getLang(file, sgModule)
    const rootNode = language?.parse(source).root()
    if (!rootNode) throw new Error(`pi-lens could not parse ${file}`)
    const diagnostics = astGrepNapi.evaluateAstGrepRules(
      file,
      rootNode,
      stageDir,
      lensFileKinds.detectFileKind(file),
    )
    if (
      expectedMessage
        ? !diagnostics.some((diagnostic) =>
            diagnostic.message.includes(expectedMessage),
          )
        : diagnostics.length !== 0
    ) {
      throw new Error(`pi-lens did not execute ${file} NAPI diagnostics`)
    }
  }

  const factStoreModule = await import(
    pathToFileURL(join(lensRoot, "dist/clients/dispatch/fact-store.js"))
  )
  const factStoreReports = []
  const previousFactStoreReporter =
    factStoreModule.getFactStoreEvictionReporter()
  factStoreModule.setFactStoreEvictionReporter((...entry) =>
    factStoreReports.push(entry),
  )
  try {
    const factStore = new factStoreModule.FactStore("dispatch")
    const pinnedFile = join(stageDir, "lens-pinned.ts")
    const otherFile = join(stageDir, "lens-other.ts")
    const pinnedBytes = 65 * 1024 * 1024
    factStore.beginDispatchFor(pinnedFile)
    factStore.setFileFact(pinnedFile, "file.content", "x".repeat(pinnedBytes))
    factStore.setFileFact(otherFile, "file.content", "test")
    if (
      factStore.getPinnedContentBytes() !== pinnedBytes ||
      factStore.getRetainedContentBytes() !== pinnedBytes + 4 ||
      !factStore.hasFileFact(pinnedFile, "file.content") ||
      !factStore.hasFileFact(otherFile, "file.content") ||
      factStoreReports.length !== 1 ||
      factStoreReports[0]?.[0] !== "dispatch" ||
      factStoreReports[0]?.[1] !== "pinned-over-budget"
    ) {
      throw new Error("pi-lens FactStore lost its pinned byte-cap contract")
    }
    factStore.endDispatchFor(pinnedFile)
    if (
      factStore.getPinnedContentBytes() !== 0 ||
      factStore.getRetainedContentBytes() !== 4 ||
      factStore.hasFileFact(pinnedFile, "file.content") ||
      !factStore.hasFileFact(otherFile, "file.content")
    ) {
      throw new Error("pi-lens FactStore did not release its pinned content")
    }
  } finally {
    factStoreModule.setFactStoreEvictionReporter(previousFactStoreReporter)
  }

  const sessionRoots = await import(
    pathToFileURL(join(lensRoot, "dist/clients/lsp/session-roots.js"))
  )
  const primaryRoot = join(stageDir, "lens-primary")
  const nestedRoot = join(primaryRoot, "nested")
  sessionRoots.resetSessionRootsForTests()
  try {
    sessionRoots.registerSessionRoot(primaryRoot)
    sessionRoots.registerSessionRoot(nestedRoot)
    if (
      sessionRoots.isOutsideAllSessionRoots(join(primaryRoot, "a.ts")) ||
      sessionRoots.isOutsideAllSessionRoots(join(nestedRoot, "b.ts")) ||
      !sessionRoots.isOutsideAllSessionRoots(join(stageDir, "outside.ts")) ||
      sessionRoots.shouldInitializeSessionRoot(
        primaryRoot,
        new Set([resolve(primaryRoot)]),
      ) ||
      !sessionRoots.shouldInitializeSessionRoot(
        nestedRoot,
        new Set([resolve(primaryRoot)]),
      )
    ) {
      throw new Error("pi-lens lost its multi-root session registry contract")
    }
  } finally {
    sessionRoots.resetSessionRootsForTests()
  }

  const instanceRegistry = await import(
    pathToFileURL(join(lensRoot, "dist/clients/instance-registry.js"))
  )
  const primaryInstanceRoot = join(stageDir, "instance-primary")
  let instanceRoots = [primaryInstanceRoot]
  for (let index = 1; index <= 40; index++) {
    instanceRoots = instanceRegistry.mergeInstanceRoots(
      instanceRoots,
      join(stageDir, `instance-${index}`),
    )
  }
  const footprint = instanceRegistry.computeResourceFootprint([
    {
      pid: 42,
      projectRoot: primaryInstanceRoot,
      projectRoots: instanceRoots.slice(0, 2),
      rssBytes: 10,
      cpuPercent: 1,
      lspChildren: [{ rssBytes: 3, cpuPercent: 2 }],
    },
  ])
  if (
    instanceRoots.length !== 32 ||
    instanceRoots[0] !== primaryInstanceRoot ||
    instanceRoots[1] !== join(stageDir, "instance-10") ||
    instanceRoots.at(-1) !== join(stageDir, "instance-40") ||
    footprint.totalRssBytes !== 13 ||
    footprint.totalCpuPercent !== 3 ||
    footprint.totalLspChildCount !== 1 ||
    JSON.stringify(footprint.perInstance[0]?.projectRoots) !==
      JSON.stringify(instanceRoots.slice(0, 2))
  ) {
    throw new Error("pi-lens lost its bounded instance-root accounting")
  }
  const lensLspUrl = pathToFileURL(
    join(lensRoot, "dist/clients/lsp/index.js"),
  ).href
  const [lensLspFirst, lensLspSecond] = await Promise.all([
    import(`${lensLspUrl}?aggregate-smoke=first`),
    import(`${lensLspUrl}?aggregate-smoke=second`),
  ])
  if (lensLspFirst.getLSPService() !== lensLspSecond.getLSPService()) {
    throw new Error(
      "pi-lens LSP service is not shared across module generations",
    )
  }
  lensLspSecond.resetLSPService({ reason: "quit" })

  // Exercise the published ask-user-question state seams as well as its manifest:
  // Slack-style bindings must keep newline ahead of submit, while submit still
  // confirms both a custom answer and a multi-select Next row. The headless
  // editors must not consume submit, and expanded paste markers must survive the
  // draft mirror path used when a dialog is restored.
  const askRequire = createRequire(join(askRoot, askEntryRelative))
  const { createJiti: createAskJiti } = await import(
    pathToFileURL(askRequire.resolve("jiti"))
  )
  const askJiti = createAskJiti(askManifestPath, { moduleCache: false })
  const askToolModule = await askJiti.import(
    join(askRoot, "ask-user-question.ts"),
  )
  if (askToolModule.BEL !== "\x07") {
    throw new Error("ask-user-question terminal attention is not standard BEL")
  }
  const previousXdgConfigHome = process.env.XDG_CONFIG_HOME
  const askConfigRoot = join(stageDir, "ask-config")
  const askConfigDir = join(askConfigRoot, "rpiv-ask-user-question")
  const askConfigPath = join(askConfigDir, "config.json")
  process.env.XDG_CONFIG_HOME = askConfigRoot
  let askTool
  try {
    const registerAskTool = () => {
      let registered
      askToolModule.registerAskUserQuestionTool({
        registerTool(tool) {
          registered = tool
        },
        events: { emit() {} },
      })
      if (!registered) {
        throw new Error("ask-user-question did not register its tool")
      }
      return registered
    }

    askTool = registerAskTool()
    await mkdir(askConfigDir, { recursive: true })
    await writeFile(
      askConfigPath,
      `${JSON.stringify({ guidance: { description: "Aggregate guidance override" } })}\n`,
    )
    const guidedAskTool = registerAskTool()
    if (guidedAskTool.description !== "Aggregate guidance override") {
      throw new Error("ask-user-question ignored guidance.description")
    }
    await writeFile(
      askConfigPath,
      `${JSON.stringify({ guidance: { description: "" } })}\n`,
    )
    const fallbackAskTool = registerAskTool()
    if (fallbackAskTool.description !== askTool.description) {
      throw new Error("ask-user-question empty guidance did not use defaults")
    }
  } finally {
    if (previousXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = previousXdgConfigHome
  }
  const askParams = {
    questions: [
      {
        question: "Pick one",
        header: "Choice",
        options: [
          { label: "A", description: "First" },
          { label: "B", description: "Second" },
        ],
      },
    ],
  }
  const { buildQuestionnaireResponse, DECLINE_MESSAGE } = await askJiti.import(
    join(askRoot, "tool", "response-envelope.ts"),
  )
  const answer = {
    questionIndex: 0,
    question: "Pick one",
    kind: "option",
    answer: "A",
  }
  const notedResponse = buildQuestionnaireResponse(
    { answers: [answer], cancelled: false, globalNote: "Remember this" },
    askParams,
  )
  if (
    !notedResponse.content[0].text.includes('"Pick one"="A".') ||
    !notedResponse.content[0].text.includes("global note: Remember this.")
  ) {
    throw new Error("ask-user-question omitted a global Submit note")
  }
  const noteOnlyResponse = buildQuestionnaireResponse(
    { answers: [], cancelled: false, globalNote: "Only context" },
    askParams,
  )
  if (
    noteOnlyResponse.details.cancelled ||
    !noteOnlyResponse.content[0].text.includes("global note: Only context.")
  ) {
    throw new Error("ask-user-question did not accept a note-only submission")
  }
  const cancelledNoteResponse = buildQuestionnaireResponse(
    { answers: [answer], cancelled: true, globalNote: "Private detail" },
    askParams,
  )
  if (
    cancelledNoteResponse.content[0].text !== DECLINE_MESSAGE ||
    cancelledNoteResponse.content[0].text.includes("Private detail") ||
    cancelledNoteResponse.details.globalNote !== "Private detail" ||
    !cancelledNoteResponse.details.cancelled
  ) {
    throw new Error(
      "ask-user-question cancellation did not retain its note only in details",
    )
  }
  const runAskAttention = async (isTTY) => {
    const originalIsTTY = Object.getOwnPropertyDescriptor(
      process.stdout,
      "isTTY",
    )
    const originalWrite = process.stdout.write
    const writes = []
    Object.defineProperty(process.stdout, "isTTY", {
      value: isTTY,
      configurable: true,
    })
    process.stdout.write = (chunk) => {
      writes.push(String(chunk))
      return true
    }
    try {
      await askTool.execute(
        "aggregate-bell",
        askParams,
        new AbortController().signal,
        undefined,
        {
          hasUI: true,
          mode: "rpc",
          ui: {
            select: async () => undefined,
            input: async () => undefined,
          },
        },
      )
    } finally {
      process.stdout.write = originalWrite
      if (originalIsTTY) {
        Object.defineProperty(process.stdout, "isTTY", originalIsTTY)
      } else {
        delete process.stdout.isTTY
      }
    }
    return writes
  }
  const ttyWrites = await runAskAttention(true)
  if (ttyWrites.length !== 1 || ttyWrites[0] !== "\x07") {
    throw new Error(
      `ask-user-question TTY attention must emit one BEL, got ${JSON.stringify(ttyWrites)}`,
    )
  }
  if ((await runAskAttention(false)).length !== 0) {
    throw new Error(
      "ask-user-question emitted terminal attention outside a TTY",
    )
  }
  const { routeKey } = await askJiti.import(
    join(askRoot, "state", "key-router.ts"),
  )
  const { Editor } = await askJiti.import("@earendil-works/pi-tui")
  const keyMap = {
    "tui.select.confirm": "enter",
    "tui.input.submit": "ctrl+enter",
    "tui.input.newLine": "enter",
  }
  const keybindings = {
    matches(data, name) {
      return keyMap[name] === data
    },
  }
  const baseState = {
    currentTab: 0,
    optionIndex: 0,
    inputMode: false,
    notesVisible: false,
    answers: new Map(),
    multiSelectChecked: new Set(),
    customDraftsByTab: new Map(),
    notesByTab: new Map(),
    submitChoiceIndex: 0,
    notesDraft: "",
    collapsed: false,
  }
  const singleQuestion = {
    question: "Pick one",
    multiSelect: false,
    options: [{ label: "Yes" }],
  }
  const singleRuntime = {
    keybindings,
    inputBuffer: "draft",
    canMoveInputUp: false,
    canMoveInputDown: false,
    questions: [singleQuestion],
    isMulti: false,
    currentItem: { kind: "option", label: "Yes" },
    items: [{ kind: "option", label: "Yes" }],
    collapseKey: "off",
  }
  const { buildHintText } = await askJiti.import(
    join(askRoot, "view", "tab-content-strategy.ts"),
  )
  const configuredCollapseHint = buildHintText(
    singleQuestion,
    false,
    baseState,
    "ctrl+pagedown",
  )
  if (!configuredCollapseHint.includes("Ctrl+PageDown to collapse")) {
    throw new Error(
      "ask-user-question did not render its configured collapse key",
    )
  }
  if (
    buildHintText(singleQuestion, false, baseState, "off").includes("collapse")
  ) {
    throw new Error("ask-user-question advertised a disabled collapse shortcut")
  }
  if (routeKey("ctrl+]", baseState, singleRuntime).kind !== "ignore") {
    throw new Error("ask-user-question accepted its disabled collapse shortcut")
  }

  const { QuestionnaireSession } = await askJiti.import(
    join(askRoot, "state", "questionnaire-session.ts"),
  )
  const askTheme = new Proxy(
    {},
    {
      get:
        () =>
        (...args) =>
          String(args.at(-1) ?? ""),
    },
  )
  const createCollapseSession = (canReopenWhileHidden) => {
    const hiddenStates = []
    const session = new QuestionnaireSession({
      tui: { requestRender() {} },
      theme: askTheme,
      params: askParams,
      itemsByTab: [askToolModule.buildItemsForQuestion(askParams.questions[0])],
      done() {},
      keybindings,
      editInput: async () => undefined,
      collapseKey: "ctrl+]",
      canReopenWhileHidden,
    })
    session.setOverlayHandle({
      setHidden(hidden) {
        hiddenStates.push(hidden)
      },
    })
    return { session, hiddenStates }
  }
  const fallbackCollapse = createCollapseSession(false)
  fallbackCollapse.session.toggleCollapsedExternal()
  if (
    fallbackCollapse.hiddenStates.length !== 0 ||
    fallbackCollapse.session.component.render(80).length !== 1
  ) {
    throw new Error(
      "ask-user-question hid an overlay without a raw-input reopen path",
    )
  }
  const hiddenCollapse = createCollapseSession(true)
  hiddenCollapse.session.toggleCollapsedExternal()
  if (hiddenCollapse.hiddenStates[0] !== true) {
    throw new Error(
      "ask-user-question did not hide a safely reopenable overlay",
    )
  }

  if (
    routeKey("enter", { ...baseState, inputMode: true }, singleRuntime).kind !==
    "ignore"
  ) {
    throw new Error("ask-user-question newline must not submit an inline draft")
  }
  if (
    routeKey("ctrl+enter", { ...baseState, inputMode: true }, singleRuntime)
      .kind !== "confirm"
  ) {
    throw new Error(
      "ask-user-question submit binding must confirm an inline draft",
    )
  }
  const multiQuestion = {
    question: "Pick several",
    multiSelect: true,
    options: [{ label: "Yes" }],
  }
  const multiRuntime = {
    ...singleRuntime,
    questions: [multiQuestion],
    currentItem: { kind: "next", label: "Next" },
    items: [{ kind: "next", label: "Next" }],
  }
  if (
    routeKey("ctrl+enter", baseState, multiRuntime).kind !== "multi_confirm"
  ) {
    throw new Error(
      "ask-user-question submit binding must confirm a multi-select",
    )
  }
  const editor = new Editor(
    { requestRender() {} },
    { borderColor: (text) => text },
  )
  let submits = 0
  editor.onSubmit = () => submits++
  editor.setText("draft")
  editor.disableSubmit = true
  editor.handleInput("\r")
  if (submits !== 0 || editor.getText() !== "draft") {
    throw new Error("ask-user-question headless editor consumed submit")
  }
  const pasted = "x".repeat(1001)
  const pasteEditor = new Editor(
    { requestRender() {} },
    { borderColor: (text) => text },
  )
  pasteEditor.handleInput(`\u001b[200~${pasted}\u001b[201~`)
  if (pasteEditor.getExpandedText() !== pasted) {
    throw new Error("ask-user-question lost expanded paste-marker text")
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

  const mcpRequire = createRequire(join(mcpRoot, mcpEntryRelative))
  const { createJiti: createMcpJiti } = await import(
    pathToFileURL(mcpRequire.resolve("jiti"))
  )
  const mcpJiti = createMcpJiti(mcpManifestPath, {
    alias: {
      "@earendil-works/pi-ai": join(
        root,
        "node_modules/@earendil-works/pi-ai/dist/index.js",
      ),
      "@earendil-works/pi-ai/compat": join(
        root,
        "node_modules/@earendil-works/pi-ai/dist/compat.js",
      ),
    },
    moduleCache: false,
  })
  const { KNOWN_SERVER_PRESETS } = await mcpJiti.import(
    join(mcpRoot, "config.ts"),
  )
  const parallelSearchPreset = KNOWN_SERVER_PRESETS.find(
    (preset) => preset.id === "parallel-search",
  )
  if (
    parallelSearchPreset?.entry.url !== "https://search.parallel.ai/mcp" ||
    parallelSearchPreset.entry.directTools !== true
  ) {
    throw new Error("pi-mcp-adapter lost its Parallel Search setup preset")
  }
  const { updateStatusBar } = await mcpJiti.import(join(mcpRoot, "init.ts"))
  let plainThemeStatus
  updateStatusBar({
    config: {
      mcpServers: { parallel: parallelSearchPreset.entry },
      settings: { mcpFooterStatus: "compact" },
    },
    manager: { getAllConnections: () => [] },
    ui: {
      theme: "plain",
      setStatus: (key, value) => {
        if (key === "mcp") plainThemeStatus = value
      },
    },
  })
  if (plainThemeStatus !== "MCP 0/1") {
    throw new Error("pi-mcp-adapter plain-theme status fallback failed")
  }

  const packageMcpCwd = join(stageDir, "package-mcp")
  const packageMcpConfigDir = join(packageMcpCwd, ".pi")
  const packageMcpRoot = join(packageMcpConfigDir, "fixture")
  await mkdir(packageMcpRoot, { recursive: true })
  await writeFile(
    join(packageMcpConfigDir, "settings.json"),
    `${JSON.stringify({ packages: ["./fixture"] })}\n`,
  )
  await writeFile(
    join(packageMcpRoot, "package.json"),
    `${JSON.stringify({ name: "@smoke/pack", pi: { mcp: "./mcp.json" } })}\n`,
  )
  await writeFile(
    join(packageMcpRoot, "mcp.json"),
    `${JSON.stringify({ mcpServers: { alpha: { command: "node", args: ["server.mjs"] } } })}\n`,
  )
  const previousCodingAgentDir = process.env.PI_CODING_AGENT_DIR
  const previousPiPackageDir = process.env.PI_PACKAGE_DIR
  process.env.PI_CODING_AGENT_DIR = join(stageDir, "mcp-agent")
  process.env.PI_PACKAGE_DIR = packageRoot
  try {
    const { loadPackageMcpConfigs } = await mcpJiti.import(
      join(mcpRoot, "package-mcp-loader.ts"),
    )
    const packageMcpConfig = loadPackageMcpConfigs(packageMcpCwd)
    const packageServer = packageMcpConfig.mcpServers.smoke_pack__alpha
    if (
      packageServer?.command !== "node" ||
      packageServer.args?.[0] !== "server.mjs"
    ) {
      throw new Error(
        "pi-mcp-adapter did not load a package-declared MCP server",
      )
    }
  } finally {
    if (previousCodingAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR
    } else {
      process.env.PI_CODING_AGENT_DIR = previousCodingAgentDir
    }
    if (previousPiPackageDir === undefined) delete process.env.PI_PACKAGE_DIR
    else process.env.PI_PACKAGE_DIR = previousPiPackageDir
  }

  const { ensureToolCallApproved } = await mcpJiti.import(
    join(mcpRoot, "tool-approval.ts"),
  )
  let approvalPrompts = 0
  const approvalState = {
    config: { mcpServers: { smoke: { approveTools: true } } },
    approvedToolCalls: new Map(),
    toolMetadata: new Map(),
    ui: {
      select: async () => {
        approvalPrompts++
        return "Allow for session"
      },
    },
  }
  const approvalTool = { name: "mcp_smoke_write", originalName: "write" }
  await ensureToolCallApproved(approvalState, "smoke", approvalTool, {
    path: "a.txt",
    content: "first",
  })
  await ensureToolCallApproved(approvalState, "smoke", approvalTool, {
    content: "first",
    path: "a.txt",
  })
  await ensureToolCallApproved(approvalState, "smoke", approvalTool, {
    path: "a.txt",
    content: "changed",
  })
  if (approvalPrompts !== 2 || approvalState.approvedToolCalls.size !== 2) {
    throw new Error(
      "pi-mcp-adapter approvals were not scoped to normalized tool arguments",
    )
  }

  const mcpCommandsSource = await readFile(join(mcpRoot, "commands.ts"), "utf8")
  if (
    !/return ctx\.hasUI && ctx\.mode === ["']tui["'];/.test(
      mcpCommandsSource,
    ) ||
    !/export async function openMcpPanel[\s\S]*?if \(!canRenderPanel\(ctx\)\) \{[\s\S]*?await showStatus\(state, ctx\);/.test(
      mcpCommandsSource,
    )
  ) {
    throw new Error("pi-mcp-adapter RPC panel lost its text fallback guard")
  }
  const mcpAuthFlow = await mcpJiti.import(join(mcpRoot, "mcp-auth-flow.ts"))
  if (
    mcpAuthFlow.parseAuthorizationCodeInput(
      "https://callback.test/complete?code=smoke-code&state=smoke-state",
      "smoke-state",
    ) !== "smoke-code"
  ) {
    throw new Error("pi-mcp-adapter lost full callback URL parsing")
  }
  let mismatchedOAuthStateRejected = false
  try {
    mcpAuthFlow.parseAuthorizationCodeInput(
      "https://callback.test/complete?code=smoke-code&state=wrong",
      "smoke-state",
    )
  } catch (error) {
    mismatchedOAuthStateRejected =
      error instanceof Error && error.message.includes("state mismatch")
  }
  if (!mismatchedOAuthStateRejected) {
    throw new Error("pi-mcp-adapter accepted a mismatched OAuth state")
  }
  const manualOAuth = await mcpAuthFlow.waitForAuthorizationResponse(
    new Promise(() => {}),
    "https://auth.test/authorize",
    "smoke-state",
    async () =>
      "https://callback.test/complete?code=manual-code&state=smoke-state",
  )
  if (
    manualOAuth.source !== "manual" ||
    manualOAuth.input.code !== "manual-code"
  ) {
    throw new Error("pi-mcp-adapter lost manual HTTPS OAuth completion")
  }
  const { McpServerManager } = await mcpJiti.import(
    join(mcpRoot, "server-manager.ts"),
  )
  const mcpClientCapabilities =
    McpServerManager.prototype.buildClientCapabilities.call({
      samplingConfig: undefined,
      elicitationConfig: undefined,
    })
  if (
    JSON.stringify(
      mcpClientCapabilities.extensions?.["io.modelcontextprotocol/ui"],
    ) !== JSON.stringify({ mimeTypes: ["text/html;profile=mcp-app"] })
  ) {
    throw new Error("pi-mcp-adapter lost its MCP UI client capability")
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
  const expectedBtwVersion = "0.56.1"
  if (
    sourceManifest.dependencies["@narumitw/pi-btw"] !== expectedBtwVersion ||
    btwManifest.version !== expectedBtwVersion
  ) {
    throw new Error(
      `Expected aggregate and bundled pi-btw ${expectedBtwVersion}, got ${sourceManifest.dependencies["@narumitw/pi-btw"]} and ${btwManifest.version}`,
    )
  }
  if (btwManifest.license !== "MIT") {
    throw new Error(`Expected pi-btw MIT license, got ${btwManifest.license}`)
  }
  const btwEntryRelative = "./dist/index.ts"
  if (!btwManifest.pi?.extensions?.includes(btwEntryRelative)) {
    throw new Error("Bundled pi-btw no longer declares its expected Pi entry")
  }
  const expectedTuiKitRange = "^0.59.0"
  if (
    sourceManifest.dependencies["@narumitw/pi-tui-kit"] !==
      expectedTuiKitRange ||
    btwManifest.dependencies?.["@narumitw/pi-tui-kit"] !== expectedTuiKitRange
  ) {
    throw new Error(
      `Expected aggregate and bundled pi-tui-kit dependency ${expectedTuiKitRange}`,
    )
  }
  const caffeinateRoot = join(
    packageRoot,
    "node_modules",
    "@narumitw",
    "pi-caffeinate",
  )
  const caffeinateManifestPath = join(caffeinateRoot, "package.json")
  const caffeinateManifest = parseJson(
    await readFile(caffeinateManifestPath, "utf8"),
    caffeinateManifestPath,
  )
  const expectedCaffeinateVersion =
    sourceManifest.dependencies["@narumitw/pi-caffeinate"]
  if (
    caffeinateManifest.name !== "@narumitw/pi-caffeinate" ||
    caffeinateManifest.version !== expectedCaffeinateVersion ||
    caffeinateManifest.license !== "MIT"
  ) {
    throw new Error(
      "Bundled pi-caffeinate does not match its pinned MIT package contract",
    )
  }
  const caffeinateEntryRelative = "./dist/index.ts"
  if (!caffeinateManifest.pi?.extensions?.includes(caffeinateEntryRelative)) {
    throw new Error(
      "Bundled pi-caffeinate no longer declares its expected Pi entry",
    )
  }
  const expectedDbusRange = caffeinateManifest.dependencies?.["dbus-native"]
  if (
    !expectedDbusRange ||
    sourceManifest.dependencies["dbus-native"] !== expectedDbusRange
  ) {
    throw new Error(
      `Expected promoted dbus-native dependency ${expectedDbusRange}, got ${sourceManifest.dependencies["dbus-native"]}`,
    )
  }

  const btwEntry = join(btwRoot, btwEntryRelative)
  const btwDistSource = await readFile(btwEntry, "utf8")
  await stat(`${btwEntry}.map`)
  const btwRequire = createRequire(btwEntry)
  const { createJiti: createBtwJiti } = await import(
    pathToFileURL(btwRequire.resolve("jiti"))
  )
  const btwJiti = createBtwJiti(btwManifestPath, {
    alias: {
      "@earendil-works/pi-ai": join(
        root,
        "node_modules/@earendil-works/pi-ai/dist/compat.js",
      ),
      "@earendil-works/pi-coding-agent": join(
        root,
        "node_modules/@earendil-works/pi-coding-agent/dist/index.js",
      ),
      "@earendil-works/pi-tui": join(
        root,
        "node_modules/@earendil-works/pi-tui/dist/index.js",
      ),
    },
    fsCache: false,
    moduleCache: false,
  })
  // 0.56.0's public entry is the bundled dist. Add test-only exports in memory
  // so these regressions exercise that exact artifact rather than its src mirror.
  const btwProbe = await btwJiti.evalModule(
    `${btwDistSource}\nexport { BtwTranscriptPager, createBtwFullscreenTui, pickMainEntry, runBtwMenuPreservingEditor, updateBtwSettings };\n`,
    { filename: btwEntry, async: true, forceTranspile: true },
  )
  const {
    BtwTranscriptPager,
    createBtwFullscreenTui,
    pickMainEntry,
    runBtwMenuPreservingEditor,
    updateBtwSettings,
  } = btwProbe
  const styleTheme = {
    bg: (_color, text) => `bg:${text}`,
    bold: (text) => `bold:${text}`,
    fg: (_color, text) => `fg:${text}`,
    inverse: (text) => `inverse:${text}`,
    underline: (text) => `underline:${text}`,
  }
  const copiedSelections = []
  const btwKeybindings = { matches: () => false }
  const fullscreenTui = createBtwFullscreenTui(
    { terminal: {}, getShowHardwareCursor: () => false },
    styleTheme,
    btwKeybindings,
    true,
    false,
    () => {},
    async (text) => {
      copiedSelections.push(text)
    },
  )
  if (
    fullscreenTui.searchMatchStyle("needle") !== "underline:bg:fg:needle" ||
    fullscreenTui.searchCurrentMatchStyle("needle") !==
      "bold:inverse:bg:fg:needle" ||
    (await fullscreenTui.copySelection("copy me")) !== true ||
    copiedSelections[0] !== "copy me"
  ) {
    throw new Error("pi-btw fullscreen search or clipboard integration failed")
  }
  const failingClipboardTui = createBtwFullscreenTui(
    { terminal: {}, getShowHardwareCursor: () => false },
    styleTheme,
    btwKeybindings,
    true,
    false,
    () => {},
    async () => {
      throw new Error("clipboard unavailable")
    },
  )
  if ((await failingClipboardTui.copySelection("copy me")) !== false) {
    throw new Error("pi-btw fullscreen clipboard failure was not reported")
  }
  let manualSelectionRejected = false
  try {
    createBtwFullscreenTui(
      { terminal: {}, getShowHardwareCursor: () => false },
      styleTheme,
      btwKeybindings,
      false,
      false,
      () => {},
      async () => {},
    )
  } catch (error) {
    manualSelectionRejected =
      error instanceof Error &&
      error.message.includes(
        "Manual fullscreen selection copying is unavailable",
      )
  }
  if (!manualSelectionRejected) {
    throw new Error("pi-btw manual selection copy did not fail closed")
  }
  const manualCopyFlashes = []
  let manualCopyCount = 0
  const manualCopyTui = createBtwFullscreenTui(
    { terminal: {}, getShowHardwareCursor: () => false },
    styleTheme,
    {
      matches: (data, key) => data === "COPY" && key === "app.message.copy",
    },
    false,
    true,
    () => {},
    async () => {},
  )
  manualCopyTui.hasActiveSelection = () => true
  manualCopyTui.copyActiveSelectionToClipboard = async () => {
    manualCopyCount++
  }
  manualCopyTui.flash = (message) => manualCopyFlashes.push(message)
  manualCopyTui.handleTerminalInput("COPY")
  await new Promise((resolvePromise) => setImmediate(resolvePromise))
  manualCopyTui.hasActiveSelection = () => false
  manualCopyTui.handleTerminalInput("COPY")
  if (
    manualCopyCount !== 1 ||
    JSON.stringify(manualCopyFlashes) !==
      JSON.stringify(["No selection to copy"])
  ) {
    throw new Error("pi-btw manual selection copy path is not operational")
  }

  let mainDraft = "original main draft"
  const menuResult = await runBtwMenuPreservingEditor(
    {
      mode: "tui",
      hasUI: true,
      ui: {
        getEditorText: () => mainDraft,
        setEditorText: (text) => {
          mainDraft = text
        },
        custom: async (factory) => {
          let outcome
          mainDraft = "latest main draft"
          factory({}, styleTheme, {}, (value) => {
            outcome = value
          })
          mainDraft = "clobbered during menu teardown"
          return outcome
        },
      },
    },
    async ({ ui }) => {
      await ui.custom((_tui, _theme, _keybindings, done) => {
        done({ kind: "closed" })
        return {}
      })
      return { kind: "closed" }
    },
  )
  if (menuResult.kind !== "closed" || mainDraft !== "latest main draft") {
    throw new Error("pi-btw did not preserve the live main editor draft")
  }

  const btwSettingsPath = join(stageDir, "pi-btw-settings.json")
  await updateBtwSettings(
    { thinkingLevel: "high", rememberThinkingLevelChanges: true },
    { settingsPath: btwSettingsPath },
  )
  await updateBtwSettings(
    { thinkingLevel: undefined },
    { settingsPath: btwSettingsPath },
  )
  const sameAsMainSettings = parseJson(
    await readFile(btwSettingsPath, "utf8"),
    btwSettingsPath,
  )
  if (
    Object.hasOwn(sameAsMainSettings, "thinkingLevel") ||
    sameAsMainSettings.rememberThinkingLevelChanges !== true
  ) {
    throw new Error(
      "pi-btw Same as main thread did not remove only the fixed thinking level",
    )
  }

  let mainTreeCustomCalls = 0
  const mainTreeNotifications = []
  const emptyTreeResult = await pickMainEntry(
    { setLabel() {} },
    {
      sessionManager: { getTree: () => [], getLeafId: () => null },
      ui: {
        custom: async () => {
          mainTreeCustomCalls++
        },
        notify: (message, level) =>
          mainTreeNotifications.push({ message, level }),
      },
    },
  )
  if (
    emptyTreeResult.kind !== "back" ||
    mainTreeCustomCalls !== 0 ||
    mainTreeNotifications[0]?.message !== "No main-thread entries are available"
  ) {
    throw new Error("pi-btw empty main tree did not return to its menu safely")
  }

  const { initTheme } = await btwJiti.import("@earendil-works/pi-coding-agent")
  initTheme()
  const passthroughTheme = {
    fg: (_color, text) => text,
    bg: (_color, text) => text,
    bold: (text) => text,
  }
  const pager = new BtwTranscriptPager(
    { terminal: { rows: 10 }, requestRender() {} },
    passthroughTheme,
    Array.from({ length: 20 }, (_, index) => ({
      kind: "error",
      question: `Question ${index}`,
      answer: `Answer ${index}\nDetail ${index}`,
    })),
    () => {},
    { startAtBottom: true },
  )
  const bottomLines = pager.render(60)
  const layoutNodeSymbol = Symbol.for("@earendil-works/pi-tui/layout-node")
  const layoutNode = pager.getFullscreenLayout()[layoutNodeSymbol]?.()
  const transcriptScrollView = layoutNode?.entries?.[1]?.component
  const scrollNode = transcriptScrollView?.[layoutNodeSymbol]?.()
  const scrollState = scrollNode?.state
  const bottomOffset = scrollState?.scrollTop
  if (
    scrollNode?.type !== "scroll" ||
    scrollState?.primary !== true ||
    !Number.isInteger(bottomOffset) ||
    bottomOffset <= 0
  ) {
    throw new Error(
      "pi-btw transcript did not expose a primary native ScrollView",
    )
  }
  scrollState.scrollBy(-Math.max(1, scrollState.viewportHeight))
  const olderLines = pager.render(60)
  if (
    scrollState.scrollTop >= bottomOffset ||
    JSON.stringify(olderLines) === JSON.stringify(bottomLines) ||
    olderLines[0] !== bottomLines[0] ||
    !olderLines.some((line) => line.includes("Ctrl+C")) ||
    !bottomLines.some((line) => line.includes("Ctrl+C"))
  ) {
    throw new Error(
      "pi-btw native transcript scrolling did not preserve its fixed chrome",
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
  if (fastModeManifest.peerDependencies?.["@earendil-works/pi-tui"] !== "*") {
    throw new Error("Bundled fast-mode must reuse the aggregate Pi TUI host")
  }
  const fastModeSourceMap = parseJson(
    await readFile(join(fastModeRoot, `${fastModeEntryRelative}.map`), "utf8"),
    `${fastModeEntryRelative}.map`,
  )
  if (
    fastModeSourceMap.sources?.some((source) =>
      /(?:marked|@earendil-works[+/]pi-tui)/.test(source),
    )
  ) {
    throw new Error("Bundled fast-mode still contains inline TUI dependencies")
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
      "^0.84.4" ||
    sourceManifest.dependencies["@earendil-works/pi-tui"] !== "^0.84.4"
  ) {
    throw new Error(
      'Aggregate Pi host ranges must be exactly "^0.84.4"; update this check when the host is bumped',
    )
  }
  const installedHosts = await Promise.all(
    hostDependencies.map(async (hostDependency) => {
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
    }),
  )
  for (const { hostDependency, version } of installedHosts) {
    // Keep the 0.84 line pinned while accepting compatible later patches;
    // bump the source range and this guard together when Pi moves again.
    const patch = /^0\.84\.(\d+)$/.exec(version)?.[1]
    if (patch === undefined || Number(patch) < 4) {
      throw new Error(
        `Expected remote-pi ${hostDependency} host compatible with ^0.84.4, got ${version}`,
      )
    }
  }

  const resumeFromRoot = join(
    packageRoot,
    "node_modules",
    "@herbertgao",
    "resume-from",
  )
  const resumeFromManifestPath = join(resumeFromRoot, "package.json")
  const resumeFromManifest = parseJson(
    await readFile(resumeFromManifestPath, "utf8"),
    resumeFromManifestPath,
  )
  const expectedResumeFromVersion =
    sourceManifest.dependencies["@herbertgao/resume-from"]
  if (
    resumeFromManifest.name !== "@herbertgao/resume-from" ||
    resumeFromManifest.version !== expectedResumeFromVersion
  ) {
    throw new Error(
      `Expected bundled resume-from ${expectedResumeFromVersion}, got ${resumeFromManifest.version}`,
    )
  }
  if (resumeFromManifest.license !== "MIT") {
    throw new Error(
      `Expected resume-from MIT license, got ${resumeFromManifest.license}`,
    )
  }
  const resumeFromEntryRelative = "./shims/pi/extensions/resume-from.js"
  if (!resumeFromManifest.pi?.extensions?.includes(resumeFromEntryRelative)) {
    throw new Error(
      "Bundled resume-from no longer declares its expected Pi entry",
    )
  }
  if (
    resumeFromManifest.engines?.node !== ">=24" ||
    sourceManifest.engines?.node !== ">=24"
  ) {
    throw new Error("Aggregate must preserve resume-from's Node 24 baseline")
  }
  const expectedTokenizerRange =
    resumeFromManifest.dependencies?.["gpt-tokenizer"]
  if (
    !expectedTokenizerRange ||
    manifest.dependencies["gpt-tokenizer"] !== expectedTokenizerRange
  ) {
    throw new Error(
      `Expected promoted gpt-tokenizer ${expectedTokenizerRange}, got ${manifest.dependencies["gpt-tokenizer"]}`,
    )
  }

  const directTifanPackages = [
    "@tifan/pi-copy-response",
    "@tifan/pi-handoff",
    "@tifan/pi-inline-skills",
    "@tifan/pi-mermaid-open",
    "@tifan/pi-preferred-thinking",
    "@tifan/pi-recap",
    "@tifan/pi-rename",
  ]
  await Promise.all(
    directTifanPackages.map(async (packageName) => {
      const packageManifestPath = join(
        packageRoot,
        "node_modules",
        ...packageName.split("/"),
        "package.json",
      )
      const packageManifest = parseJson(
        await readFile(packageManifestPath, "utf8"),
        packageManifestPath,
      )
      const expectedVersion = sourceManifest.dependencies[packageName]
      if (
        packageManifest.name !== packageName ||
        packageManifest.version !== expectedVersion ||
        packageManifest.license !== "MIT" ||
        !packageManifest.pi?.extensions?.length
      ) {
        throw new Error(
          `Bundled ${packageName} does not match its pinned MIT Pi package contract`,
        )
      }
      const packagePrefix = `./node_modules/${packageName}/`
      const declaredEntries = packageManifest.pi.extensions
        .map((entry) => `${packagePrefix}${entry.replace(/^\.\//u, "")}`)
        .toSorted()
      const configuredEntries = manifest.pi.extensions
        .filter((entry) => entry.startsWith(packagePrefix))
        .toSorted()
      if (
        JSON.stringify(declaredEntries) !== JSON.stringify(configuredEntries)
      ) {
        throw new Error(
          `Aggregate Pi entries for ${packageName} differ from its published manifest`,
        )
      }
      return undefined
    }),
  )

  const handoffEntry = join(
    packageRoot,
    "node_modules/@tifan/pi-handoff/src/index.ts",
  )
  const handoffSource = await readFile(handoffEntry, "utf8")
  const handoffRequire = createRequire(handoffEntry)
  const { createJiti: createHandoffJiti } = await import(
    pathToFileURL(handoffRequire.resolve("jiti"))
  )
  const previousHandoffAgentDir = process.env.PI_CODING_AGENT_DIR
  const handoffAgentDir = join(stageDir, "handoff-agent")
  process.env.PI_CODING_AGENT_DIR = handoffAgentDir
  try {
    const handoffProbe = await createHandoffJiti(handoffEntry, {
      alias: {
        "@earendil-works/pi-ai": join(
          root,
          "node_modules/@earendil-works/pi-ai/dist/index.js",
        ),
        "@earendil-works/pi-ai/compat": join(
          root,
          "node_modules/@earendil-works/pi-ai/dist/compat.js",
        ),
        "@earendil-works/pi-coding-agent": join(
          root,
          "node_modules/@earendil-works/pi-coding-agent/dist/index.js",
        ),
        "@earendil-works/pi-tui": join(
          root,
          "node_modules/@earendil-works/pi-tui/dist/index.js",
        ),
      },
      moduleCache: false,
    }).evalModule(`${handoffSource}\nexport { startHandoffInHerdr };\n`, {
      filename: handoffEntry,
      async: true,
      forceTranspile: true,
    })
    const handoffSessionName =
      handoffProbe.formatHandoffSessionName("smoke-handoff")
    const handoffCwd = join(stageDir, "handoff-cwd")
    const handoffPath = join(handoffCwd, "handoff.md")
    const handoffCalls = []
    await mkdir(handoffCwd, { recursive: true })
    await handoffProbe.startHandoffInHerdr({
      pi: {
        exec: async (command, args, options) => {
          handoffCalls.push({ command, args, options })
          return args[0] === "tab"
            ? {
                code: 0,
                stdout: JSON.stringify({
                  result: { root_pane: { pane_id: "pane-smoke" } },
                }),
                stderr: "",
              }
            : { code: 0, stdout: "", stderr: "" }
        },
      },
      ctx: {
        cwd: handoffCwd,
        model: { provider: "smoke-provider", id: "smoke-model" },
      },
      handoffPath,
      parentSession: "/parent/session.jsonl",
      sessionName: handoffSessionName,
      workspaceId: "workspace-smoke",
    })
    const [createTab, startAgent, promptAgent] = handoffCalls
    const tabLabelArgumentIndex = createTab?.args.indexOf("--label") ?? -1
    const tabLabel = createTab?.args[tabLabelArgumentIndex + 1]
    const sessionArgumentIndex = startAgent?.args.indexOf("--session") ?? -1
    const childSessionPath = startAgent?.args[sessionArgumentIndex + 1]
    const childHeader = childSessionPath
      ? JSON.parse((await readFile(childSessionPath, "utf8")).split("\n")[0])
      : undefined
    if (
      handoffCalls.length !== 3 ||
      createTab.command !== "herdr" ||
      JSON.stringify(createTab.args.slice(0, 2)) !==
        JSON.stringify(["tab", "create"]) ||
      handoffSessionName !== "[handoff] smoke-handoff" ||
      createTab.args.includes("--focus") ||
      tabLabel !== handoffSessionName ||
      !createTab.args.includes("workspace-smoke") ||
      createTab.options?.timeout !== 5_000 ||
      startAgent.command !== "herdr" ||
      JSON.stringify(startAgent.args.slice(0, 2)) !==
        JSON.stringify(["agent", "start"]) ||
      !startAgent.args.includes("pane-smoke") ||
      !startAgent.args.includes("smoke-provider") ||
      !startAgent.args.includes("smoke-model") ||
      startAgent.options?.timeout !== 35_000 ||
      promptAgent.command !== "herdr" ||
      JSON.stringify(promptAgent.args.slice(0, 2)) !==
        JSON.stringify(["agent", "prompt"]) ||
      !promptAgent.args.at(-1)?.includes(handoffPath) ||
      childHeader?.cwd !== handoffCwd ||
      childHeader?.parentSession !== "/parent/session.jsonl"
    ) {
      throw new Error("Bundled Handoff lost its background Herdr tab flow")
    }
  } finally {
    if (previousHandoffAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR
    } else {
      process.env.PI_CODING_AGENT_DIR = previousHandoffAgentDir
    }
  }

  const recapEntry = join(
    packageRoot,
    "node_modules/@tifan/pi-recap/src/index.ts",
  )
  const recapRequire = createRequire(recapEntry)
  const { createJiti: createRecapJiti } = await import(
    pathToFileURL(recapRequire.resolve("jiti"))
  )
  const initializeRecap = (
    await createRecapJiti(recapEntry, { moduleCache: false }).import(recapEntry)
  ).default
  const recapHandlers = new Map()
  initializeRecap({
    registerCommand() {},
    on(event, handler) {
      recapHandlers.set(event, handler)
    },
  })
  const scheduledRecaps = []
  const originalSetTimeout = globalThis.setTimeout
  globalThis.setTimeout = (_callback, delay) => {
    scheduledRecaps.push(delay)
    return { unref() {} }
  }
  try {
    recapHandlers.get("session_compact_failed")({ willRetry: false })
    recapHandlers.get("agent_settled")({}, {})
    if (scheduledRecaps.length !== 0) {
      throw new Error("Recap scheduled work after failed compaction")
    }
    recapHandlers.get("agent_settled")({}, {})
    if (JSON.stringify(scheduledRecaps) !== JSON.stringify([300_000])) {
      throw new Error("Recap did not re-arm after skipping one away recap")
    }
  } finally {
    globalThis.setTimeout = originalSetTimeout
  }

  const renameEntry = join(
    packageRoot,
    "node_modules/@tifan/pi-rename/src/index.ts",
  )
  const renameRequire = createRequire(renameEntry)
  const { createJiti: createRenameJiti } = await import(
    pathToFileURL(renameRequire.resolve("jiti"))
  )
  const previousRenameAgentDir = process.env.PI_CODING_AGENT_DIR
  const renameAgentDir = join(stageDir, "rename-agent")
  process.env.PI_CODING_AGENT_DIR = renameAgentDir
  try {
    const renameJiti = createRenameJiti(renameEntry, { moduleCache: false })
    const renameModels = await renameJiti.import(
      join(dirname(renameEntry), "models.ts"),
    )
    const renameSanitize = await renameJiti.import(
      join(dirname(renameEntry), "sanitize.ts"),
    )
    const renameNaming = await renameJiti.import(
      join(dirname(renameEntry), "naming.ts"),
    )
    const renameConfigDir = join(renameAgentDir, "extensions")
    const renameConfigPath = join(renameConfigDir, "pi-rename.json")
    await mkdir(renameConfigDir, { recursive: true })
    await writeFile(
      renameConfigPath,
      `${JSON.stringify({ model: "old/model", language: "en", keep: "sentinel" })}\n`,
    )
    renameModels.saveRenameLanguage("zh-CN")
    renameModels.saveModelPreference({ provider: "new", id: "model" })
    const savedRenameConfig = parseJson(
      await readFile(renameConfigPath, "utf8"),
      renameConfigPath,
    )
    const localizedName = renameSanitize.sanitizeRenameText(
      "这是一个非常长的中文会话名称用于测试三十字符限制和本地化行为",
      "zh-CN",
    )
    if (
      savedRenameConfig.model !== "new/model" ||
      savedRenameConfig.language !== "zh-CN" ||
      savedRenameConfig.keep !== "sentinel" ||
      !localizedName.includes("中文") ||
      [...localizedName].length > 30 ||
      !renameNaming
        .buildRenameSystemPrompt("zh-CN")
        .includes("BCP 47 tag zh-CN")
    ) {
      throw new Error(
        "Bundled Rename lost config preservation, localization, or name limits",
      )
    }
  } finally {
    if (previousRenameAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR
    } else {
      process.env.PI_CODING_AGENT_DIR = previousRenameAgentDir
    }
  }

  const preferredThinkingEntry = join(
    packageRoot,
    "node_modules/@tifan/pi-preferred-thinking/src/index.ts",
  )
  const preferredThinkingRequire = createRequire(preferredThinkingEntry)
  const { createJiti: createPreferredThinkingJiti } = await import(
    pathToFileURL(preferredThinkingRequire.resolve("jiti"))
  )
  const initializePreferredThinking = (
    await createPreferredThinkingJiti(preferredThinkingEntry, {
      moduleCache: false,
    }).import(preferredThinkingEntry)
  ).default
  const preferredHandlers = new Map()
  const thinkingUpdates = []
  initializePreferredThinking({
    registerCommand() {},
    on(event, handler) {
      preferredHandlers.set(event, handler)
    },
    getThinkingLevel: () => "low",
    setThinkingLevel: (level) => thinkingUpdates.push(level),
  })
  const preferredModel = {
    provider: "smoke",
    id: "reasoning-model",
    reasoning: true,
  }
  const preferredContext = {
    model: preferredModel,
    scopedModels: [{ model: preferredModel, thinkingLevel: "high" }],
    hasUI: false,
    ui: { setWidget() {} },
  }
  const preferredSessionStart = preferredHandlers.get("session_start")
  const preferredModelSelect = preferredHandlers.get("model_select")
  if (
    typeof preferredSessionStart !== "function" ||
    typeof preferredModelSelect !== "function"
  ) {
    throw new Error("Preferred Thinking lost its model lifecycle handlers")
  }
  const previousSubagentId = process.env.PI_SUBAGENT_ID
  const originalArgvLength = process.argv.length
  process.env.PI_SUBAGENT_ID = "aggregate-smoke"
  process.argv.push("--thinking=medium")
  try {
    await preferredSessionStart({}, preferredContext)
    await preferredModelSelect({ model: preferredModel }, preferredContext)
  } finally {
    process.argv.length = originalArgvLength
    if (previousSubagentId === undefined) delete process.env.PI_SUBAGENT_ID
    else process.env.PI_SUBAGENT_ID = previousSubagentId
  }
  if (thinkingUpdates.length !== 0) {
    throw new Error("Preferred Thinking overrode explicit subagent thinking")
  }
  await preferredModelSelect({ model: preferredModel }, preferredContext)
  if (JSON.stringify(thinkingUpdates) !== JSON.stringify(["high"])) {
    throw new Error("Preferred Thinking no longer applies ordinary model pins")
  }

  const tifanNotices = await readFile(
    join(packageRoot, "THIRD_PARTY_NOTICES.md"),
    "utf8",
  )
  if (
    directTifanPackages.some(
      (packageName) => !tifanNotices.includes(`\`${packageName}\``),
    ) ||
    !tifanNotices.includes("Copyright (c) 2026 Tifan Dwi Avianto") ||
    !tifanNotices.includes(
      "The above copyright notice and this permission notice shall be included",
    )
  ) {
    throw new Error("Aggregate Tifan third-party notices are incomplete")
  }
  if (
    !tifanNotices.includes("`@luxusai/pi-hindsight`") ||
    !tifanNotices.includes("SPDX license identifier `MIT`") ||
    !tifanNotices.includes("does not invent one")
  ) {
    throw new Error("Aggregate pi-hindsight third-party notice is incomplete")
  }
  if (
    !tifanNotices.includes("`@narumitw/pi-caffeinate`") ||
    !tifanNotices.includes("Copyright (c) 2026 narumiruna")
  ) {
    throw new Error("Aggregate pi-caffeinate third-party notice is incomplete")
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
      "node_modules/@czottmann/pi-automode/skills/automode-diagnostics/SKILL.md",
      "node_modules/@dietrichgebert/ponytail/LICENSE",
      "node_modules/@juicesharp/rpiv-ask-user-question/LICENSE",
      "node_modules/@narumitw/pi-btw/LICENSE",
      "node_modules/@narumitw/pi-caffeinate/LICENSE",
      "node_modules/@pi-plugins/fast-mode/LICENSE",
      "node_modules/@luxusai/pi-hindsight/README.md",
      "node_modules/@luxusai/pi-hindsight/skills/hindsight-memory-doctor/SKILL.md",
      "node_modules/pi-footer/LICENSE",
      "node_modules/pi-lens/LICENSE",
      "node_modules/pi-mcp-adapter/LICENSE",
      "examples/pi-footer.json",
      "node_modules/@tifan/pi-mermaid-open/herdr-plugin/herdr-plugin.toml",
      "node_modules/@tifan/pi-mermaid-open/herdr-plugin/viewer.mjs",
      "node_modules/pi-web-access/LICENSE",
      "node_modules/remote-pi/LICENSE",
      "node_modules/@herbertgao/resume-from/LICENSE",
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
  const mcpRuntimeSmokePath = join(stageDir, "mcp-runtime-smoke.ts")
  await writeFile(
    mcpRuntimeSmokePath,
    `import { createMcpAdapter, getRuntimeMcpServerSnapshot, registerMcpServer } from ${JSON.stringify(resolve(mcpRoot, mcpEntryRelative))}\n\n` +
      `export default function runtimeSmoke(pi) {\n` +
      `  createMcpAdapter({ config: { mcpServers: {} } })(pi)\n` +
      `  const definition = { url: "https://snapshot.test/mcp", directTools: ["search"], headers: { Authorization: "Bearer test" } }\n` +
      `  const registration = registerMcpServer({ pi, name: "aggregate-runtime", definition })\n` +
      `  let inactiveRejected = false\n` +
      `  try { getRuntimeMcpServerSnapshot({ pi, name: "aggregate-runtime" }) } catch (error) { inactiveRejected = error instanceof Error && error.message.includes("no active state") }\n` +
      `  if (!inactiveRejected) throw new Error("inactive runtime MCP snapshot did not fail closed")\n` +
      `  let duplicateRejected = false\n` +
      `  try { registerMcpServer({ pi, name: "aggregate-runtime", definition: { url: "https://duplicate.test/mcp" } }) } catch (error) { duplicateRejected = error instanceof Error && error.message.includes("already registered") }\n` +
      `  if (!duplicateRejected) throw new Error("duplicate runtime MCP server accepted")\n` +
      `  pi.on("input", async () => {\n` +
      `    const snapshot = getRuntimeMcpServerSnapshot({ pi, name: "aggregate-runtime" })\n` +
      `    if (!snapshot.runtime || snapshot.persisted || snapshot.definition.directTools?.[0] !== "search") throw new Error("runtime MCP snapshot lost its detached contract")\n` +
      `    snapshot.definition.headers.Authorization = "changed"\n` +
      `    if (getRuntimeMcpServerSnapshot({ pi, name: "aggregate-runtime" }).definition.headers.Authorization !== "Bearer test") throw new Error("runtime MCP snapshot leaked a mutable definition")\n` +
      `    await registration.dispose()\n` +
      `    let disposedRejected = false\n` +
      `    try { getRuntimeMcpServerSnapshot({ pi, name: "aggregate-runtime" }) } catch (error) { disposedRejected = error instanceof Error && error.message.includes("disposed") }\n` +
      `    if (!disposedRejected) throw new Error("disposed runtime MCP snapshot remained readable")\n` +
      `    await registerMcpServer({ pi, name: "aggregate-runtime", definition: { url: "https://replacement.test/mcp" } }).dispose()\n` +
      `  })\n` +
      `}\n`,
  )
  const mcpRuntimeSmoke = await loadExtensions(
    [mcpRuntimeSmokePath],
    installDir,
  )
  if (mcpRuntimeSmoke.errors.length > 0) {
    throw new Error(
      `pi-mcp-adapter runtime registration smoke failed:\n${JSON.stringify(mcpRuntimeSmoke.errors, null, 2)}`,
    )
  }
  Object.assign(mcpRuntimeSmoke.runtime, {
    getAllTools: () => [],
    getActiveTools: () => [],
    setActiveTools: () => {},
    getCommands: () => [],
  })
  const mcpRuntimeExtension = mcpRuntimeSmoke.extensions[0]
  if (!mcpRuntimeExtension) {
    throw new Error("pi-mcp-adapter runtime smoke extension did not load")
  }
  const mcpRuntimeContext = {
    mode: "print",
    hasUI: false,
    cwd: installDir,
    model: undefined,
    modelRegistry: undefined,
    signal: undefined,
    ui: { setStatus() {}, notify() {}, setWidget() {} },
  }
  for (const handler of mcpRuntimeExtension.handlers.get("session_start") ??
    []) {
    // Lifecycle hooks must run in registration order, matching Pi.
    // eslint-disable-next-line no-await-in-loop
    await handler({}, mcpRuntimeContext)
  }
  await new Promise((resolvePromise) => setImmediate(resolvePromise))
  await new Promise((resolvePromise) => setImmediate(resolvePromise))
  for (const handler of mcpRuntimeExtension.handlers.get("input") ?? []) {
    // Lifecycle hooks must run in registration order, matching Pi.
    // eslint-disable-next-line no-await-in-loop
    await handler(
      { source: "interactive", text: "aggregate runtime snapshot smoke" },
      mcpRuntimeContext,
    )
  }
  for (const handler of mcpRuntimeExtension.handlers.get("session_shutdown") ??
    []) {
    // Lifecycle hooks must run in registration order, matching Pi.
    // eslint-disable-next-line no-await-in-loop
    await handler({ reason: "quit" }, mcpRuntimeContext)
  }

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
  const requiredChildRegistrations = [
    ["@tifan/pi-copy-response/src/index.ts", "commands", "copy-response"],
    ["@tifan/pi-handoff/src/index.ts", "commands", "__pi-handoff-session"],
    ["@tifan/pi-handoff/src/session-query.ts", "tools", "session_query"],
    ["@tifan/pi-inline-skills/src/index.ts", "commands", "loaded-skills"],
    ["@tifan/pi-mermaid-open/src/index.ts", "commands", "mermaid-open"],
    [
      "@tifan/pi-preferred-thinking/src/index.ts",
      "commands",
      "preferred-thinking",
    ],
    ["@tifan/pi-recap/src/index.ts", "commands", "recap"],
    ["@luxusai/pi-hindsight/extensions/index.ts", "tools", "hindsight_recall"],
    ["@luxusai/pi-hindsight/extensions/index.ts", "commands", "hindsight"],
    ["@tifan/pi-rename/src/index.ts", "commands", "rename"],
    [
      "@herbertgao/resume-from/shims/pi/extensions/resume-from.js",
      "commands",
      "resume-from",
    ],
  ]
  for (const [relativePath, registry, name] of requiredChildRegistrations) {
    const entry = resolve(packageRoot, "node_modules", relativePath)
    const loaded = result.extensions.find(
      (extension) => extension.resolvedPath === entry,
    )
    if (!loaded?.[registry].has(name)) {
      throw new Error(`Packed ${relativePath} did not register ${name}`)
    }
  }
  const lensEntry = resolve(lensRoot, "dist", "index.js")
  const loadedLens = result.extensions.find(
    (extension) => extension.resolvedPath === lensEntry,
  )
  for (const toolName of [
    "lens_diagnostics",
    "lsp_diagnostics",
    "pi_lens_activate_tools",
  ]) {
    if (!loadedLens?.tools.has(toolName)) {
      throw new Error(`Packed pi-lens did not register ${toolName}`)
    }
  }
  if (!loadedLens.commands.has("lens-widget-toggle")) {
    throw new Error("Packed pi-lens did not register lens-widget-toggle")
  }

  const automodeEntry = resolve(automodeRoot, automodeEntryRelative)
  if (!extensionPaths.includes(automodeEntry)) {
    throw new Error(
      "Packed aggregate is missing the pi-automode extension entry",
    )
  }
  const automodeSkills = resolve(automodeRoot, automodeSkillsRelative)
  if (!skillPaths.includes(automodeSkills)) {
    throw new Error("Packed aggregate is missing the pi-automode skills")
  }
  const loadedAutomode = result.extensions.find(
    (extension) => extension.resolvedPath === automodeEntry,
  )
  if (!loadedAutomode?.tools.has("automode_inspect")) {
    throw new Error("Packed pi-automode did not register automode_inspect")
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
  const mcpRequestHeadersCommandEntry = resolve(
    mcpRoot,
    "request-headers-command.ts",
  )
  await Promise.all([
    stat(mcpOAuthEntry),
    stat(join(mcpRoot, "cli.js")),
    stat(mcpRequestHeadersCommandEntry),
  ])
  const previousAuthStore = process.env.PI_MCP_ADAPTER_TEST_AUTH_STORE
  process.env.PI_MCP_ADAPTER_TEST_AUTH_STORE = "memory"
  try {
    const require = createRequire(mcpOAuthEntry)
    const { createJiti } = await import(pathToFileURL(require.resolve("jiti")))
    const jiti = createJiti(mcpOAuthEntry, { moduleCache: false })
    const oauth = await jiti.import(mcpOAuthEntry)
    const bearerStore = await jiti.import(join(mcpRoot, "mcp-bearer-store.ts"))
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

    bearerStore.resetTestBearerTokenStore()
    bearerStore.saveBearerTokenForUrl(serverName, "bearer-smoke", serverUrl)
    if (
      bearerStore.getBearerTokenForUrl(serverName, serverUrl) !==
        "bearer-smoke" ||
      bearerStore.getBearerTokenForUrl(
        serverName,
        "https://other.example.test/server",
      ) !== undefined ||
      bearerStore.inspectBearerTokenForUrl(
        serverName,
        "https://other.example.test/server",
      ).status !== "url-mismatch"
    ) {
      throw new Error("pi-mcp-adapter bearer tokens were not URL-bound")
    }
    bearerStore.removeBearerToken(serverName)
    if (
      bearerStore.inspectBearerTokenForUrl(serverName, serverUrl).status !==
      "missing"
    ) {
      throw new Error("pi-mcp-adapter bearer token removal failed")
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

  const caffeinateEntry = resolve(caffeinateRoot, caffeinateEntryRelative)
  if (!extensionPaths.includes(caffeinateEntry)) {
    throw new Error(
      "Packed aggregate is missing the pi-caffeinate extension entry",
    )
  }
  const loadedCaffeinate = result.extensions.find(
    (extension) => extension.resolvedPath === caffeinateEntry,
  )
  if (!loadedCaffeinate?.commands.has("caffeinate")) {
    throw new Error("Packed pi-caffeinate did not register /caffeinate")
  }

  if (!extensionPaths.includes(btwEntry)) {
    throw new Error("Packed aggregate is missing the pi-btw extension entry")
  }
  const loadedBtw = result.extensions.find(
    (extension) => extension.resolvedPath === btwEntry,
  )
  if (!loadedBtw?.commands.has("btw")) {
    throw new Error("Packed pi-btw dist did not register the /btw command")
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
  if (
    !result.extensions.some(
      (extension) => extension.resolvedPath === fastModeEntry,
    )
  ) {
    throw new Error("Packed fast-mode extension did not load")
  }
  const footerEntry = resolve(footerRoot, footerEntryRelative)
  if (!extensionPaths.includes(footerEntry)) {
    throw new Error("Packed aggregate is missing the pi-footer extension entry")
  }
  const remotePiEntry = resolve(remotePiRoot, "dist/index.js")
  if (!extensionPaths.includes(remotePiEntry)) {
    throw new Error("Packed aggregate is missing the remote-pi extension entry")
  }
  const remotePiSkills = resolve(remotePiRoot, "skills")
  if (skillPaths.includes(remotePiSkills)) {
    throw new Error(
      "Packed aggregate must not statically register remote-pi skills; the extension deploys them globally",
    )
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
