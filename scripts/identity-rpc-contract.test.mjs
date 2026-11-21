import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import test from "node:test"

const root = fileURLToPath(new URL("..", import.meta.url))

test("identity bus contract (cross-package)", () => {
  const result = spawnSync(
    "bun",
    [
      "run",
      "--cwd",
      join(root, "packages/pi-subagents"),
      "vitest",
      "run",
      "test/identity-bus-contract.test.ts",
    ],
    { encoding: "utf8", cwd: root },
  )
  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || "vitest failed",
  )
})
