import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
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

function replaceGeneratedChangelogVersion(fromVersion, toVersion) {
  if (!existsSync(aggregateChangelogPath) || fromVersion === toVersion) return

  const changelog = readFileSync(aggregateChangelogPath, "utf8")
  const fromHeading = `## ${fromVersion}`
  if (!changelog.includes(fromHeading)) return

  writeFileSync(
    aggregateChangelogPath,
    changelog.replace(fromHeading, `## ${toVersion}`),
  )
}

function main() {
  const beforeVersion = readManifest().version
  run("bunx", ["changeset", "version"])

  const manifest = readManifest()
  if (manifest.version !== beforeVersion) {
    const changesetsVersion = manifest.version
    const calverVersion = nextAggregateCalver(beforeVersion)
    manifest.version = calverVersion
    writeFileSync(
      aggregateManifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    replaceGeneratedChangelogVersion(changesetsVersion, calverVersion)
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
