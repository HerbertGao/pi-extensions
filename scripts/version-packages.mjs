import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const aggregateManifestPath = join(root, "packages/pi-extensions/package.json")
const aggregateChangelogPath = join(root, "packages/pi-extensions/CHANGELOG.md")

export function nextAggregateCalver(currentVersion, date = new Date()) {
  const match = /^(\d{4})\.(1[0-2]|[1-9])\.(\d+)$/.exec(currentVersion)
  if (!match) {
    throw new Error(`Invalid aggregate CalVer: ${currentVersion}`)
  }
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid release date")
  }

  const currentYear = Number(match[1])
  const currentMonth = Number(match[2])
  const currentPatch = Number(match[3])
  const releaseYear = date.getUTCFullYear()
  const releaseMonth = date.getUTCMonth() + 1
  const releasePatch =
    currentYear === releaseYear && currentMonth === releaseMonth
      ? currentPatch + 1
      : 0

  return `${releaseYear}.${releaseMonth}.${releasePatch}`
}

function readManifest() {
  const rawManifest = readFileSync(aggregateManifestPath, "utf8")
  try {
    return JSON.parse(rawManifest)
  } catch (error) {
    throw new Error(`Invalid JSON in ${aggregateManifestPath}`, {
      cause: error,
    })
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with status ${result.status}`,
    )
  }
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version)
  if (!match) throw new Error(`Invalid version: ${version}`)
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split(".") : null,
  }
}

function compareIdentifiers(left, right) {
  const leftNumber = /^\d+$/.test(left)
  const rightNumber = /^\d+$/.test(right)
  if (leftNumber && rightNumber) return Math.sign(Number(left) - Number(right))
  if (leftNumber) return -1
  if (rightNumber) return 1
  if (left === right) return 0
  return left < right ? -1 : 1
}

export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1
  }
  if (!a.pre && !b.pre) return 0
  if (!a.pre) return 1
  if (!b.pre) return -1
  const length = Math.max(a.pre.length, b.pre.length)
  for (let index = 0; index < length; index += 1) {
    if (a.pre[index] === undefined) return -1
    if (b.pre[index] === undefined) return 1
    const compared = compareIdentifiers(a.pre[index], b.pre[index])
    if (compared !== 0) return compared
  }
  return 0
}

// Local releases stay on the imported upstream version. A `-local.N` suffix is
// older than that release, so it never occupies upstream's next number.
export function nextTrackedUpstreamVersion(currentVersion, upstreamVersion) {
  if (!/^\d+\.\d+\.\d+$/.test(upstreamVersion)) {
    throw new Error(`Invalid upstream version: ${upstreamVersion}`)
  }
  const local = /^(.+)-local\.(\d+)$/.exec(currentVersion)
  const next =
    local && local[1] === upstreamVersion
      ? `${upstreamVersion}-local.${Number(local[2]) + 1}`
      : `${upstreamVersion}-local.1`
  if (compareVersions(next, currentVersion) <= 0) {
    throw new Error(
      `Refusing to move ${currentVersion} to ${next}: the upstream version is already published`,
    )
  }
  return next
}

function replaceGeneratedChangelogVersion(changelogPath, fromVersion, toVersion) {
  if (!existsSync(changelogPath) || fromVersion === toVersion) return

  const changelog = readFileSync(changelogPath, "utf8")
  const fromHeading = `## ${fromVersion}`
  if (!changelog.includes(fromHeading)) return

  writeFileSync(changelogPath, changelog.replace(fromHeading, `## ${toVersion}`))
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}`, { cause: error })
  }
}

function trackedPackages() {
  return readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = join(root, "packages", entry.name, "package.json")
      if (!existsSync(manifestPath)) return null
      const manifest = readJson(manifestPath)
      if (manifest["x-upstream"]?.trackVersion !== true) return null
      return {
        name: manifest.name,
        version: manifest.version,
        manifestPath,
        changelogPath: join(root, "packages", entry.name, "CHANGELOG.md"),
      }
    })
    .filter(Boolean)
}

function replaceExactVersion(path, fromVersion, toVersion) {
  const raw = readFileSync(path, "utf8")
  const from = `"${fromVersion}"`
  if (!raw.includes(from)) {
    throw new Error(`${path} does not contain version ${fromVersion}`)
  }
  writeFileSync(path, raw.replaceAll(from, `"${toVersion}"`))
}

function applyTrackedUpstreamVersions(before) {
  const aggregate = readJson(aggregateManifestPath)
  let aggregateChanged = false

  for (const entry of before) {
    const manifest = readJson(entry.manifestPath)
    if (manifest.version === entry.version) continue
    const next = nextTrackedUpstreamVersion(
      entry.version,
      manifest["x-upstream"].version,
    )
    replaceExactVersion(entry.manifestPath, manifest.version, next)
    replaceGeneratedChangelogVersion(entry.changelogPath, manifest.version, next)
    if (aggregate.dependencies?.[entry.name]) {
      aggregate.dependencies[entry.name] = next
      aggregateChanged = true
    }
    process.stdout.write(`Tracked upstream version: ${entry.name} ${entry.version} -> ${next}\n`)
  }

  if (aggregateChanged) {
    writeFileSync(aggregateManifestPath, `${JSON.stringify(aggregate, null, 2)}\n`)
  }
}

function main() {
  const beforeVersion = readManifest().version
  const beforeTracked = trackedPackages()
  run("bunx", ["changeset", "version"])
  applyTrackedUpstreamVersions(beforeTracked)

  const manifest = readManifest()
  if (manifest.version !== beforeVersion) {
    const changesetsVersion = manifest.version
    const calverVersion = nextAggregateCalver(beforeVersion)
    manifest.version = calverVersion
    writeFileSync(
      aggregateManifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    replaceGeneratedChangelogVersion(
      aggregateChangelogPath,
      changesetsVersion,
      calverVersion,
    )
    process.stdout.write(
      `Aggregate CalVer: ${beforeVersion} -> ${calverVersion}\n`,
    )
  }

  run("bun", ["install"])
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main()
}
