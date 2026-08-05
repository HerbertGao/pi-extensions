import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { run } from "./process.mjs"

const npmEnv = {
  ...process.env,
  // Outer `npm pack --dry-run` must not suppress staging tarballs.
  NPM_CONFIG_DRY_RUN: "false",
  npm_config_dry_run: "false",
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const aggregateDir = join(root, "packages", "pi-extensions")
const nodeModulesDir = join(aggregateDir, "node_modules")
const backupDir = join(aggregateDir, ".aggregate-node-modules-backup")
const statePath = join(aggregateDir, ".aggregate-pack-state.json")
const manifestBackupPath = join(aggregateDir, ".aggregate-package-backup.json")

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === "ENOENT") return false
    throw error
  }
}

function parseJson(text, source) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Invalid JSON in ${source}`, { cause: error })
  }
}

async function readJson(path) {
  const contents = await readFile(path, "utf8")
  return parseJson(contents, path)
}

async function restore() {
  const hasState = await pathExists(statePath)
  const hasBackup = await pathExists(backupDir)
  const hasManifestBackup = await pathExists(manifestBackupPath)
  if (!hasState && !hasBackup && !hasManifestBackup) return

  let hadNodeModules = hasBackup
  if (hasState) {
    const state = await readJson(statePath)
    hadNodeModules = state.hadNodeModules === true
  }

  await rm(nodeModulesDir, { recursive: true, force: true })
  if (hadNodeModules && hasBackup) {
    await rename(backupDir, nodeModulesDir)
  }
  if (hasManifestBackup) {
    await cp(manifestBackupPath, join(aggregateDir, "package.json"))
  }
  await rm(backupDir, { recursive: true, force: true })
  await rm(manifestBackupPath, { force: true })
  await rm(statePath, { force: true })
}

async function packWorkspacePackages(tarballsDir) {
  const packagesDir = join(root, "packages")
  const packageEntries = await readdir(packagesDir, { withFileTypes: true })
  const packageDirs = packageEntries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith("pi-") &&
        entry.name !== "pi-extensions",
    )
    .map((entry) => join(packagesDir, entry.name))

  await mkdir(tarballsDir, { recursive: true })
  const tarballByName = new Map()
  for (const packageDir of packageDirs) {
    const output = run(
      "npm",
      ["pack", "--json", "--pack-destination", tarballsDir, packageDir],
      { env: npmEnv },
    ).stdout
    const [packed] = parseJson(output, `npm pack output for ${packageDir}`)
    tarballByName.set(packed.name, join(tarballsDir, packed.filename))
  }
  return tarballByName
}

async function buildMaterializedNodeModules(stageDir) {
  const tarballsDir = join(stageDir, "tarballs")
  const stagedAggregateDir = join(stageDir, "aggregate")
  await cp(aggregateDir, stagedAggregateDir, {
    recursive: true,
    filter: (source) =>
      ![nodeModulesDir, backupDir, statePath, manifestBackupPath].includes(
        source,
      ),
  })
  await rm(join(stagedAggregateDir, "node_modules"), {
    recursive: true,
    force: true,
  })

  const tarballByName = await packWorkspacePackages(tarballsDir)
  const manifestPath = join(stagedAggregateDir, "package.json")
  const manifest = await readJson(manifestPath)
  const publishedDependencies = { ...manifest.dependencies }

  for (const name of Object.keys(manifest.dependencies)) {
    const tarball = tarballByName.get(name)
    if (tarball) {
      manifest.dependencies[name] = `file:${tarball}`
    } else if (name.startsWith("@herbertgao/")) {
      throw new Error(`No workspace tarball found for ${name}`)
    }
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--legacy-peer-deps",
      "--package-lock=false",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: stagedAggregateDir, env: npmEnv },
  )

  manifest.dependencies = publishedDependencies
  const bundled = new Set(manifest.bundledDependencies)
  const installedNodeModules = join(stagedAggregateDir, "node_modules")

  const childManifests = await Promise.all(
    [...bundled].map((name) =>
      readJson(join(installedNodeModules, ...name.split("/"), "package.json")),
    ),
  )
  for (const childManifest of childManifests) {
    for (const [dependency, range] of Object.entries(
      childManifest.dependencies ?? {},
    )) {
      if (!bundled.has(dependency)) {
        manifest.dependencies[dependency] ??= range
      }
    }
    for (const [dependency, range] of Object.entries(
      childManifest.optionalDependencies ?? {},
    )) {
      if (!bundled.has(dependency) && !manifest.dependencies[dependency]) {
        manifest.optionalDependencies ??= {}
        manifest.optionalDependencies[dependency] ??= range
      }
    }
  }

  const installedEntries = await readdir(installedNodeModules, {
    withFileTypes: true,
  })
  await Promise.all(
    installedEntries.map(async (entry) => {
      const entryPath = join(installedNodeModules, entry.name)
      if (entry.name === ".bin" || entry.name === ".package-lock.json") {
        await rm(entryPath, { recursive: true, force: true })
        return undefined
      }
      if (entry.name.startsWith("@")) {
        const children = await readdir(entryPath)
        await Promise.all(
          children
            .filter((child) => !bundled.has(`${entry.name}/${child}`))
            .map((child) =>
              rm(join(entryPath, child), { recursive: true, force: true }),
            ),
        )
      } else if (!bundled.has(entry.name)) {
        await rm(entryPath, { recursive: true, force: true })
      }
      return undefined
    }),
  )
  await Promise.all(
    [...bundled].map((name) =>
      rm(join(installedNodeModules, ...name.split("/"), "node_modules"), {
        recursive: true,
        force: true,
      }),
    ),
  )

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return { manifest, nodeModules: installedNodeModules }
}

async function prepare() {
  await restore()
  const stageDir = await mkdtemp(join(tmpdir(), "pi-extensions-bundle-"))

  try {
    const materialized = await buildMaterializedNodeModules(stageDir)
    const hadNodeModules = await pathExists(nodeModulesDir)
    if (hadNodeModules) await rename(nodeModulesDir, backupDir)
    await cp(join(aggregateDir, "package.json"), manifestBackupPath)
    await cp(materialized.nodeModules, nodeModulesDir, { recursive: true })
    await writeFile(
      join(aggregateDir, "package.json"),
      `${JSON.stringify(materialized.manifest, null, 2)}\n`,
    )
    await writeFile(
      statePath,
      `${JSON.stringify({ hadNodeModules, stage: basename(stageDir) })}\n`,
    )
  } catch (error) {
    await restore()
    throw error
  } finally {
    await rm(stageDir, { recursive: true, force: true })
  }
}

const command = process.argv[2]
if (command === "prepare") {
  await prepare()
} else if (command === "restore") {
  await restore()
} else {
  throw new Error("Usage: aggregate-bundle.mjs <prepare|restore>")
}
