import { readFile } from "node:fs/promises"
import { parseJson } from "./npm-pack-json.mjs"

const root = new URL("../", import.meta.url)
const readJson = async (path) =>
  parseJson(await readFile(new URL(path, root), "utf8"), path)
const rootManifest = await readJson("package.json")
const hostPackages = Object.keys(rootManifest.devDependencies).filter(
  (name) =>
    name.startsWith("@earendil-works/pi-") ||
    name === "typebox" ||
    name === "@sinclair/typebox",
)
const packages = [
  "pi-bark",
  "pi-cc-extensions",
  "pi-extensions",
  "pi-subagents",
  "sol-pi",
]
const manifests = await Promise.all(
  packages.map((name) => readJson(`packages/${name}/package.json`)),
)
const errors = []
for (const manifest of manifests) {
  for (const dependency of hostPackages) {
    for (const section of ["dependencies", "optionalDependencies"]) {
      if (manifest[section]?.[dependency] !== undefined) {
        errors.push(
          `${manifest.name} ${section}.${dependency}: use peerDependencies with a "*" range`,
        )
      }
    }
    const peer = manifest.peerDependencies?.[dependency]
    if (peer !== undefined && peer !== "*") {
      errors.push(
        `${manifest.name} peerDependencies.${dependency}: ${peer} (expected *)`,
      )
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(
  `Pi host dependency declarations valid (${manifests.length} packages)`,
)
