import assert from "node:assert/strict"
import test from "node:test"

import { issueSyncAction } from "./check-upstreams.mjs"

test("opens the rolling issue only for upstream releases", () => {
  assert.equal(issueSyncAction(["release"], []), "open")
  assert.equal(issueSyncAction([], []), "close")
  assert.equal(issueSyncAction([], ["network error"]), "unchanged")
  assert.equal(issueSyncAction(["release"], ["network error"]), "open")
})
