import assert from "node:assert/strict"
import test from "node:test"

import { findOpenTrackingIssue, issueSyncAction } from "./check-upstreams.mjs"

test("opens the rolling issue only for upstream releases", () => {
  assert.equal(issueSyncAction(["release"], []), "open")
  assert.equal(issueSyncAction([], []), "close")
  assert.equal(issueSyncAction([], ["network error"]), "unchanged")
  assert.equal(issueSyncAction(["release"], ["network error"]), "open")
})

test("updates only an open upstream tracking issue", () => {
  const closed = {
    number: 6,
    title: "chore: upstream updates available",
    state: "closed",
  }
  const open = { ...closed, number: 37, state: "open" }

  assert.equal(findOpenTrackingIssue([closed, open]), open)
  assert.equal(findOpenTrackingIssue([closed]), undefined)
  assert.equal(
    findOpenTrackingIssue([
      { ...open, title: "another issue" },
      { ...open, pull_request: {} },
    ]),
    undefined,
  )
})
