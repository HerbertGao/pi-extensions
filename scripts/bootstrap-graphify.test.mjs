import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const script = join(root, "scripts/bootstrap-graphify.sh")
const bash = "/usr/bin/bash"

function executableLines(source) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
}

function writeExecutable(dir, name, source) {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  writeFileSync(path, source)
  chmodSync(path, 0o755)
  return path
}

function runBootstrap(pathDirs, extraEnv = {}) {
  return spawnSync(bash, [script], {
    encoding: "utf8",
    env: {
      HOME: extraEnv.HOME ?? tmpdir(),
      PATH: pathDirs.join(":"),
      UV_LOG: extraEnv.UV_LOG,
      GRAPHIFY_LOG: extraEnv.GRAPHIFY_LOG,
      GRAPHIFY_BIN: extraEnv.GRAPHIFY_BIN,
    },
  })
}

test("pin is the checked PyPI release and stays out of npm", () => {
  const requirements = readFileSync(join(root, "pins/graphifyy"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
  assert.deepEqual(requirements, ["graphifyy==0.9.97"])

  const aggregate = readFileSync(
    join(root, "packages/pi-extensions/package.json"),
    "utf8",
  )
  assert.equal(aggregate.includes("graphify"), false)

  const rootPackage = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  )
  assert.equal(rootPackage.scripts.postinstall, undefined)
  assert.equal(
    JSON.stringify(rootPackage.scripts).includes("bootstrap-graphify"),
    false,
  )
  assert.match(
    readFileSync(join(root, "README.md"), "utf8"),
    /\[Graphify\]\(docs\/graphify\.md\)/,
  )
})

test("default bootstrap installs the plain pin and the Pi skill", () => {
  const source = readFileSync(script, "utf8")
  const commands = executableLines(source)
  assert.equal(
    commands.some((line) => line.includes("graphifyy[mcp]")),
    false,
  )
  assert.equal(
    commands.some((line) => line.includes("pi guard")),
    false,
  )
  assert.equal(
    source.includes('# uv tool install "graphifyy[mcp]==X.Y.Z"'),
    true,
  )
  assert.equal(source.includes("# graphify pi guard install"), true)
  assert.equal(spawnSync(bash, ["-n", script]).status, 0)

  const dir = mkdtempSync(join(tmpdir(), "graphify-bootstrap-"))
  try {
    const uvLog = join(dir, "uv.log")
    const graphifyLog = join(dir, "graphify.log")
    const bin = join(dir, "bin")
    writeExecutable(
      dir,
      "uv",
      `#!/bin/sh
printf '%s\\n' "$*" >> "$UV_LOG"
if [ "$1" = "tool" ] && [ "$2" = "dir" ] && [ "$3" = "--bin" ]; then
  printf '%s\\n' "$GRAPHIFY_BIN"
  exit 0
fi
if [ "$1" = "tool" ] && [ "$2" = "install" ]; then
  exit 0
fi
echo "unexpected uv args: $*" >&2
exit 2
`,
    )
    writeExecutable(
      bin,
      "graphify",
      `#!/bin/sh
printf '%s\\n' "$*" >> "$GRAPHIFY_LOG"
exit 0
`,
    )
    const result = runBootstrap([dir, "/usr/bin", "/bin"], {
      HOME: dir,
      UV_LOG: uvLog,
      GRAPHIFY_LOG: graphifyLog,
      GRAPHIFY_BIN: bin,
    })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(readFileSync(uvLog, "utf8").trim().split("\n"), [
      "tool install graphifyy==0.9.97",
      "tool dir --bin",
    ])
    assert.equal(
      readFileSync(graphifyLog, "utf8").trim(),
      "install --platform pi",
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("missing uv or graphify fails with a named error", () => {
  const missingUv = runBootstrap(["/usr/bin", "/bin"])
  assert.notEqual(missingUv.status, 0)
  assert.match(missingUv.stderr, /uv is not on PATH/)

  const dir = mkdtempSync(join(tmpdir(), "graphify-bootstrap-missing-"))
  try {
    const emptyBin = join(dir, "empty-bin")
    writeExecutable(
      dir,
      "uv",
      `#!/bin/sh
if [ "$1" = "tool" ] && [ "$2" = "install" ]; then
  exit 0
fi
if [ "$1" = "tool" ] && [ "$2" = "dir" ]; then
  printf '%s\\n' "${emptyBin}"
  exit 0
fi
exit 2
`,
    )
    const missingGraphify = runBootstrap([dir, "/usr/bin", "/bin"], {
      HOME: dir,
    })
    assert.notEqual(missingGraphify.status, 0)
    assert.match(missingGraphify.stderr, /graphify is not on PATH/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
