export function parseJson(text, source) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Invalid JSON in ${source}`, { cause: error })
  }
}

export function parseNpmPackOutput(text, source) {
  const parsed = parseJson(text, source)
  let entries = []
  if (Array.isArray(parsed)) {
    entries = parsed
  } else if (parsed && typeof parsed === "object") {
    entries = Object.values(parsed)
  }

  if (entries.length !== 1) {
    throw new Error(`Expected one packed package in ${source}`)
  }

  const [packed] = entries
  if (
    !packed ||
    typeof packed !== "object" ||
    typeof packed.name !== "string" ||
    typeof packed.filename !== "string"
  ) {
    throw new Error(`Invalid packed package metadata in ${source}`)
  }

  return packed
}

export function findPublishedManifestDrift(sourceManifest, packedManifest) {
  const drift = []
  for (const section of ["dependencies", "optionalDependencies"]) {
    const sourceDependencies = sourceManifest[section] ?? {}
    const packedDependencies = packedManifest[section] ?? {}
    for (const [name, range] of Object.entries(packedDependencies)) {
      if (sourceDependencies[name] !== range) {
        drift.push(
          `${section}.${name}: source=${JSON.stringify(sourceDependencies[name])} packed=${JSON.stringify(range)}`,
        )
      }
    }
  }
  return drift
}
