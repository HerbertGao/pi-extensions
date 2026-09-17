import { readdir, readFile } from "node:fs/promises"
import { setTimeout as sleep } from "node:timers/promises"
import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packagesDir = join(root, "packages")
const entries = await readdir(packagesDir, { withFileTypes: true })
const retryPublish = process.env.VERIFY_RETRY_PUBLISH === "true"

const publishable = (
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) return null
      const manifestPath = join(packagesDir, entry.name, "package.json")
      try {
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
        if (!manifest.private && manifest.publishConfig?.access === "public") {
          return {
            name: manifest.name,
            version: manifest.version,
            dir: join(packagesDir, entry.name),
          }
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error
      }
      return null
    }),
  )
).filter(Boolean)

async function lookupPublishedVersion(name, version, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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
    // eslint-disable-next-line no-await-in-loop
    if (attempt < maxAttempts - 1)
      await sleep(Math.min(10_000, 2_000 * (attempt + 1)))
  }
  return ""
}

function republish(dir) {
  console.log(`Retrying npm publish in ${dir}…`)
  const result = spawnSync(
    "npm",
    ["publish", "--access", "public", "--provenance"],
    { cwd: dir, encoding: "utf8", stdio: "inherit" },
  )
  return result.status === 0
}

const verifiedResults = await Promise.all(
  publishable.map(async ({ name, version }) => {
    const published = await lookupPublishedVersion(name, version)
    return published === version ? null : { name, version }
  }),
)
let missing = verifiedResults.filter(Boolean)

if (missing.length > 0 && retryPublish) {
  console.log(
    `\n${missing.length} package(s) missing on npm — retrying publish…`,
  )
  for (const { name } of missing) {
    const pkg = publishable.find((p) => p.name === name)
    if (pkg) republish(pkg.dir)
  }
  // Re-verify after retry (shorter window — 6 attempts ≈ 42 s)
  const recheck = await Promise.all(
    missing.map(async ({ name, version }) => {
      const published = await lookupPublishedVersion(name, version, 6)
      return published === version ? null : `${name}@${version}`
    }),
  )
  missing = recheck.filter(Boolean)
}

if (missing.length > 0) {
  console.error(`Unpublished package versions detected (${missing.length}):`)
  for (const m of missing)
    console.error(`- ${typeof m === "string" ? m : `${m.name}@${m.version}`}`)
  console.error(
    "Recovery owner: HerbertGao. Bootstrap the missing package's npm trusted publisher, verify with npm view, then rerun this Release workflow; do not bump the aggregate version.",
  )
  process.exit(1)
}

console.log(`Verified ${publishable.length} published package versions.`)
