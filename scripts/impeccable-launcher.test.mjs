import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const skillScripts = join(
  root,
  "packages/pi-impeccable/skills/impeccable/scripts",
)

function uname(flag) {
  const result = spawnSync("uname", [flag], { encoding: "utf8" })
  assert.equal(result.status, 0)
  return result.stdout.trim()
}

function platform() {
  const os = {
    Darwin: "darwin",
    Linux: "linux",
  }[uname("-s")]
  const arch = {
    arm64: "arm64",
    aarch64: "arm64",
    x86_64: "x64",
    amd64: "x64",
  }[uname("-m")]
  assert.ok(os && arch, "this test runs on darwin or linux")
  return { os, arch }
}

function manifestDigest(asset) {
  const version = "0.1.21"
  const text = spawnSync("cat", [join(skillScripts, "engine-checksums.txt")], {
    encoding: "utf8",
  }).stdout
  for (const line of text.split("\n")) {
    const [pinned, name, sum] = line.trim().split(/\s+/)
    if (pinned === version && name === asset) return sum
  }
  throw new Error(`missing checksum for ${asset}`)
}

function stage() {
  const dir = mkdtempSync(join(tmpdir(), "impeccable-launcher-"))
  const scripts = join(dir, "scripts")
  mkdirSync(scripts)
  cpSync(join(skillScripts, "impeccable"), join(scripts, "impeccable"))
  cpSync(join(skillScripts, "VERSION"), join(scripts, "VERSION"))
  cpSync(
    join(skillScripts, "engine-checksums.txt"),
    join(scripts, "engine-checksums.txt"),
  )
  chmodSync(join(scripts, "impeccable"), 0o755)
  const home = join(dir, "home")
  const cache = join(dir, "cache")
  mkdirSync(home)
  mkdirSync(cache)
  return { dir, scripts, home, cache }
}

function run(scripts, home, cache, args, extraEnv = {}) {
  return spawnSync("/bin/sh", [join(scripts, "impeccable"), ...args], {
    encoding: "utf8",
    env: {
      PATH: "/usr/bin:/bin",
      HOME: home,
      IMPECCABLE_HOME: cache,
      IMPECCABLE_DOWNLOAD_BASE: "http://127.0.0.1:9",
      ...extraEnv,
    },
  })
}

function writeExecutable(path, source) {
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, source)
  chmodSync(path, 0o755)
}

const siblingSource = (version) => `#!/bin/sh
if [ "\${1}" = "engine-probe" ]; then
  printf 'impeccable-engine ${version}\\n'
  exit 0
fi
printf 'RAN\\n'
exit 0
`

test("launcher skips a sibling engine that reports another version", () => {
  const { dir, scripts, home, cache } = stage()
  const { os, arch } = platform()
  try {
    writeExecutable(
      join(scripts, "bin", `${os}-${arch}`, "impeccable"),
      siblingSource("0.1.18"),
    )
    const result = run(scripts, home, cache, ["live"])
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, "")
    assert.match(result.stderr, /skipping/)
    assert.match(result.stderr, /0\.1\.18/)
    assert.match(result.stderr, /0\.1\.21/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("launcher runs a sibling engine that reports the pinned version", () => {
  const { dir, scripts, home, cache } = stage()
  const { os, arch } = platform()
  try {
    writeExecutable(
      join(scripts, "bin", `${os}-${arch}`, "impeccable"),
      siblingSource("0.1.21"),
    )
    const result = run(scripts, home, cache, ["live"])
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, "RAN\n")
    assert.doesNotMatch(result.stderr, /skipping/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("launcher executes IMPECCABLE_BIN without an engine-probe", () => {
  const { dir, scripts, home, cache } = stage()
  try {
    const bin = join(dir, "override")
    writeExecutable(bin, "#!/bin/sh\nprintf 'BIN %s\\n' \"$1\"\nexit 0\n")
    const result = run(scripts, home, cache, ["live"], { IMPECCABLE_BIN: bin })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, "BIN live\n")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a verified cache stamp with the wrong size does not skip the hash", () => {
  const { dir, scripts, home, cache } = stage()
  const { os, arch } = platform()
  try {
    const cached = join(cache, "bin", "0.1.21", "impeccable")
    writeExecutable(cached, "#!/bin/sh\nprintf 'CACHE\\n'\nexit 0\n")
    const size = spawnSync("wc", ["-c", cached], { encoding: "utf8" })
    const bytes = Number(size.stdout.trim().split(/\s+/)[0])
    const expected = manifestDigest(`impeccable-${os}-${arch}`)
    writeFileSync(
      join(cache, "bin", "0.1.21", "impeccable.verified"),
      `${expected} ${bytes + 1}\n`,
    )
    const result = run(scripts, home, cache, ["live"])
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, "")
    assert.match(result.stderr, /cannot verify the cached engine/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a verified cache stamp with the recorded size runs without hashing", () => {
  const { dir, scripts, home, cache } = stage()
  const { os, arch } = platform()
  try {
    const cached = join(cache, "bin", "0.1.21", "impeccable")
    writeExecutable(cached, "#!/bin/sh\nprintf 'CACHE\\n'\nexit 0\n")
    const size = spawnSync("wc", ["-c", cached], { encoding: "utf8" })
    const bytes = Number(size.stdout.trim().split(/\s+/)[0])
    const expected = manifestDigest(`impeccable-${os}-${arch}`)
    writeFileSync(
      join(cache, "bin", "0.1.21", "impeccable.verified"),
      `${expected} ${bytes}\n`,
    )
    const result = run(scripts, home, cache, ["live"])
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, "CACHE\n")
    assert.doesNotMatch(result.stderr, /cannot verify/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
