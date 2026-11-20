import assert from "node:assert/strict"
import test from "node:test"

import {
  MAX_ATTEMPTS,
  POLL_INTERVAL_MS,
  REGISTRY_STAGING_MESSAGE,
  SECONDARY_RECOVERY_MESSAGE,
  pollWindowMinutes,
} from "./verify-published-packages.mjs"

test("npm view polling waits about 15 minutes", () => {
  assert.equal(MAX_ATTEMPTS, 60)
  assert.equal(POLL_INTERVAL_MS, 15_000)
  assert.equal(MAX_ATTEMPTS * POLL_INTERVAL_MS, 15 * 60 * 1000)
  assert.equal(pollWindowMinutes(), 15)
})

test("a missing version points at registry staging before trusted publishing", () => {
  assert.match(REGISTRY_STAGING_MESSAGE, /still be staging on the npm registry/)
  assert.match(REGISTRY_STAGING_MESSAGE, /provenance/)
  assert.match(REGISTRY_STAGING_MESSAGE, /Release workflow/)
  assert.match(REGISTRY_STAGING_MESSAGE, /Do not bump package versions/)
  assert.match(SECONDARY_RECOVERY_MESSAGE, /never appears after a long wait/)
  assert.match(SECONDARY_RECOVERY_MESSAGE, /trusted publishing/)
  assert.match(SECONDARY_RECOVERY_MESSAGE, /packing/)
  assert.equal(REGISTRY_STAGING_MESSAGE.includes("trusted publishing"), false)
  assert.equal(
    REGISTRY_STAGING_MESSAGE.includes("Bootstrap the missing package"),
    false,
  )
})
