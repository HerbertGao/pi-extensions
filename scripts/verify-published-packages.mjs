import { spawnSync } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packagesDir = join(root, "packages")

// npm provenance staging can take longer than 5 minutes for large bundled
// packages. 60 attempts × 15 s = up to 15 min of polling.
export const MAX_ATTEMPTS = 60
export const POLL_INTERVAL_MS = 15_000

export const REGISTRY_STAGING_MESSAGE =
  "The missing version may still be staging on the npm registry. Large provenance packages, especially the aggregate, can stay invisible to npm view after a successful publish. Wait, then rerun node scripts/verify-published-packages.mjs or the Release workflow. Do not bump package versions."

export const SECONDARY_RECOVERY_MESSAGE =
  "If the version never appears after a long wait, check npm trusted publishing and package packing. The recovery owner is HerbertGao."

export function pollWindowMinutes(
  attempts = MAX_ATTEMPTS,
  intervalMs = POLL_INTERVAL_MS,
) {
  return Math.round((attempts * intervalMs) / 60_000)
}

async function publishablePackages() {
  const entries = await readdir(packagesDir, { withFileTypes: true })
  return (
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory()) return null
        const manifestPath = join(packagesDir, entry.name, "package.json")
        try {
          const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
          if (
            !manifest.private &&
            manifest.publishConfig?.access === "public"
          ) {
            return { name: manifest.name, version: manifest.version }
          }
        } catch (error) {
          if (error?.code !== "ENOENT") throw error
        }
        return null
      }),
    )
  ).filter(Boolean)
}

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
          `Waiting for ${name}@${version} to appear on npm (up to ${pollWindowMinutes()} min)…`,
        )
      // eslint-disable-next-line no-await-in-loop
      await sleep(POLL_INTERVAL_MS)
    }
  }
  return ""
}

async function main() {
  const publishable = await publishablePackages()
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
    console.error(REGISTRY_STAGING_MESSAGE)
    console.error(SECONDARY_RECOVERY_MESSAGE)
    process.exit(1)
  }

  console.log(`Verified ${publishable.length} published package versions.`)
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
