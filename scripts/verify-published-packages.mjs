import { readdir, readFile } from "node:fs/promises"
import { setTimeout as sleep } from "node:timers/promises"
import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packagesDir = join(root, "packages")
const entries = await readdir(packagesDir, { withFileTypes: true })
const publishable = []

for (const entry of entries) {
  if (!entry.isDirectory()) continue
  const manifestPath = join(packagesDir, entry.name, "package.json")
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    if (!manifest.private && manifest.publishConfig?.access === "public") {
      publishable.push({ name: manifest.name, version: manifest.version })
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
}

async function lookupPublishedVersion(name, version) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
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
    if (attempt < 4) await sleep(2_000 * (attempt + 1))
  }
  return ""
}

const missing = []
for (const { name, version } of publishable) {
  if ((await lookupPublishedVersion(name, version)) !== version) {
    missing.push(`${name}@${version}`)
  }
}

if (missing.length > 0) {
  console.error(`Unpublished package versions detected (${missing.length}):`)
  for (const packageVersion of missing) console.error(`- ${packageVersion}`)
  console.error(
    "Recovery owner: HerbertGao. Bootstrap the missing package's npm trusted publisher, verify with npm view, then rerun this Release workflow; do not bump the aggregate version.",
  )
  process.exit(1)
}

console.log(`Verified ${publishable.length} published package versions.`)
