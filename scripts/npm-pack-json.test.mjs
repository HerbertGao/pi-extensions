import assert from "node:assert/strict"
import test from "node:test"

import {
  findPublishedManifestDrift,
  parseNpmPackOutput,
} from "./npm-pack-json.mjs"

const packed = {
  name: "@herbertgao/example",
  filename: "herbertgao-example-1.0.0.tgz",
  version: "1.0.0",
}

test("parses npm 11 array-form pack output", () => {
  assert.deepEqual(
    parseNpmPackOutput(JSON.stringify([packed]), "npm 11"),
    packed,
  )
})

test("parses npm 12 package-keyed pack output", () => {
  assert.deepEqual(
    parseNpmPackOutput(JSON.stringify({ [packed.name]: packed }), "npm 12"),
    packed,
  )
})

test("rejects ambiguous or incomplete pack output", () => {
  assert.throws(
    () => parseNpmPackOutput("{}", "empty"),
    /Expected one packed package/,
  )
  assert.throws(
    () =>
      parseNpmPackOutput(JSON.stringify([{ name: packed.name }]), "incomplete"),
    /Invalid packed package metadata/,
  )
})

test("detects dependency differences in either manifest", () => {
  const sourceManifest = {
    dependencies: { bundled: "1.0.0", sourceOnly: "4.0.0" },
    optionalDependencies: {},
  }
  const packedManifest = {
    dependencies: { bundled: "1.0.0", runtime: "^2.0.0" },
    optionalDependencies: { native: "3.0.0" },
  }

  assert.deepEqual(findPublishedManifestDrift(sourceManifest, packedManifest), [
    'dependencies.sourceOnly: source="4.0.0" packed=undefined',
    'dependencies.runtime: source=undefined packed="^2.0.0"',
    'optionalDependencies.native: source=undefined packed="3.0.0"',
  ])
  assert.deepEqual(
    findPublishedManifestDrift(packedManifest, packedManifest),
    [],
  )
})
