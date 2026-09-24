import { readFile } from "node:fs/promises"

const root = new URL("../", import.meta.url)
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"))
const rootManifest = await readJson("package.json")
const expected = Object.fromEntries(
  Object.entries(rootManifest.devDependencies ?? {}).filter(([name]) =>
    name.startsWith("@earendil-works/pi-"),
  ),
)

const packages = [
  "pi-bark",
  "pi-cc-extensions",
  "pi-extensions",
  "pi-subagents",
  "resume-from",
  "sol-pi",
]
const errors = []
for (const name of packages) {
  const manifest = await readJson(`packages/${name}/package.json`)
  for (const section of [
    "dependencies",
    "peerDependencies",
    "devDependencies",
  ]) {
    for (const dependency of Object.keys(manifest[section] ?? {})) {
      if (
        dependency in expected &&
        manifest[section][dependency] !== expected[dependency]
      ) {
        errors.push(
          `${name} ${section}.${dependency}: ${manifest[section][dependency]} (expected ${expected[dependency]})`,
        )
      }
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(
  `Pi dependency ranges consistent (${Object.values(expected).join(", ")})`,
)
