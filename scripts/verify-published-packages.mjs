import { readdir, readFile } from "node:fs/promises"
import { setTimeout as sleep } from "node:timers/promises"
import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packagesDir = join(root, "packages")
const entries = await readdir(packagesDir, { withFileTypes: true })

// npm provenance staging can take 3-5 min for large bundled packages.
// 20 attempts × 15 s = up to 5 min of polling.
const MAX_ATTEMPTS = 20
const POLL_INTERVAL_MS = 15_000

const publishable = (
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) return null
      const manifestPath = join(packagesDir, entry.name, "package.json")
      try {
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
        if (!manifest.private && manifest.publishConfig?.access === "public") {
          return { name: manifest.name, version: manifest.version }
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error
      }
      return null
    }),
  )
).filter(Boolean)

async function lookupPublishedVersion(name, version) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = spawnSync(
      "npm",
      ["view", `${name}@${version}`, "version", "--json"],
      {
        cwd: root,
        encoding: "utf8",
      },
    )
    let publishedVersion = ""
    try {
      const parsed = JSON.parse(result.stdout.trim())
      publishedVersion = Array.isArray(parsed) ? (parsed.at(-1) ?? "") : parsed
    } catch {
      publishedVersion = result.stdout.trim().replace(/^"|"$/g, "")
    }
    if (result.status === 0 && publishedVersion === version)
      return publishedVersion
    if (attempt < MAX_ATTEMPTS - 1) {
      if (attempt === 0)
        console.log(
          `Waiting for ${name}@${version} to appear on npm (up to ${Math.round((MAX_ATTEMPTS * POLL_INTERVAL_MS) / 60_000)} min)…`,
        )
      // eslint-disable-next-line no-await-in-loop
      await sleep(POLL_INTERVAL_MS)
    }
  }
  return ""
}

const verifiedResults = await Promise.all(
  publishable.map(async ({ name, version }) => {
    const published = await lookupPublishedVersion(name, version)
    return published === version ? null : `${name}@${version}`
  }),
)
const missing = verifiedResults.filter(Boolean)

if (missing.length > 0) {
  console.error(`Unpublished package versions detected (${missing.length}):`)
  for (const packageVersion of missing) console.error(`- ${packageVersion}`)
  console.error(
    "Recovery owner: HerbertGao. Bootstrap the missing package's npm trusted publisher, verify with npm view, then rerun this Release workflow; do not bump the aggregate version.",
  )
  process.exit(1)
}

console.log(`Verified ${publishable.length} published package versions.`)
