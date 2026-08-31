import assert from "node:assert/strict"
import test from "node:test"

import {
  findOpenTrackingIssue,
  issueSyncAction,
  syncTrackingIssue,
  trackingReportFingerprint,
} from "./check-upstreams.mjs"

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

test("finds an open tracking issue on a later page without creating a duplicate", async () => {
  const open = {
    number: 37,
    title: "chore: upstream updates available",
    state: "open",
    body: "old report",
  }
  const calls = []
  const request = async (path, init = {}) => {
    calls.push({ path, init })
    if (path.endsWith("page=1")) {
      return Array.from({ length: 100 }, (_, number) => ({
        number,
        title: `other issue ${number}`,
        state: "open",
      }))
    }
    if (path.endsWith("page=2")) return [open]
    if (init.method === "PATCH") return open
    throw new Error(`Unexpected request: ${path}`)
  }

  const changedIssueNumber = await syncTrackingIssue(
    "owner/repo",
    "report",
    "open",
    request,
  )

  assert.deepEqual(
    calls.map(({ init }) => init.method ?? "GET"),
    ["GET", "GET", "PATCH"],
  )
  assert.equal(calls[2].path, "/repos/owner/repo/issues/37")
  assert.equal(changedIssueNumber, 37)
})

test("does not redispatch an acknowledged unchanged tracking issue", async () => {
  const report = "Generated: 2026-08-31T00:00:00.000Z\n\nreport"
  const fingerprint = trackingReportFingerprint(report)
  const open = {
    number: 37,
    title: "chore: upstream updates available",
    state: "open",
    body: `Generated: 2026-08-30T00:00:00.000Z\n\nreport\n\n<!-- upstream-agent-dispatched:${fingerprint} -->`,
  }
  const calls = []
  const request = async (path, init = {}) => {
    calls.push({ path, init })
    if (path.includes("?state=open")) return [open]
    throw new Error(`Unexpected request: ${path}`)
  }

  const changedIssueNumber = await syncTrackingIssue(
    "owner/repo",
    report,
    "open",
    request,
  )

  assert.equal(changedIssueNumber, undefined)
  assert.deepEqual(
    calls.map(({ init }) => init.method ?? "GET"),
    ["GET"],
  )
})

test("redispatches an unchanged report when dispatch was not acknowledged", async () => {
  const open = {
    number: 37,
    title: "chore: upstream updates available",
    state: "open",
    body: "Generated: 2026-08-30T00:00:00.000Z\n\nreport",
  }
  const calls = []
  const request = async (path, init = {}) => {
    calls.push({ path, init })
    if (path.includes("?state=open")) return [open]
    if (init.method === "PATCH") return open
    throw new Error(`Unexpected request: ${path}`)
  }

  const changedIssueNumber = await syncTrackingIssue(
    "owner/repo",
    "Generated: 2026-08-31T00:00:00.000Z\n\nreport",
    "open",
    request,
  )

  assert.equal(changedIssueNumber, 37)
  assert.deepEqual(
    calls.map(({ init }) => init.method ?? "GET"),
    ["GET", "PATCH"],
  )
})

test("creates a tracking issue when no matching open issue exists", async () => {
  const calls = []
  const request = async (path, init = {}) => {
    calls.push({ path, init })
    if (path.includes("?state=open")) return []
    if (init.method === "POST") return { number: 38, state: "open" }
    throw new Error(`Unexpected request: ${path}`)
  }

  const createdIssueNumber = await syncTrackingIssue(
    "owner/repo",
    "report",
    "open",
    request,
  )

  assert.deepEqual(
    calls.map(({ init }) => init.method ?? "GET"),
    ["GET", "POST"],
  )
  assert.equal(calls[1].path, "/repos/owner/repo/issues")
  assert.equal(createdIssueNumber, 38)
})

test("creates a replacement when the tracking issue closes during update", async () => {
  const open = {
    number: 37,
    title: "chore: upstream updates available",
    state: "open",
  }
  const calls = []
  const request = async (path, init = {}) => {
    calls.push({ path, init })
    if (path.includes("?state=open")) return [open]
    if (init.method === "PATCH") return { ...open, state: "closed" }
    if (init.method === "POST") return { ...open, number: 38 }
    throw new Error(`Unexpected request: ${path}`)
  }

  const createdIssueNumber = await syncTrackingIssue(
    "owner/repo",
    "report",
    "open",
    request,
  )

  assert.deepEqual(
    calls.map(({ init }) => init.method ?? "GET"),
    ["GET", "PATCH", "POST"],
  )
  assert.equal(createdIssueNumber, 38)
  assert.equal("state" in JSON.parse(calls[1].init.body), false)
  assert.deepEqual(JSON.parse(calls[2].init.body), {
    title: "chore: upstream updates available",
    body: "report",
  })
})

test("closes an open tracking issue as completed", async () => {
  const open = {
    number: 37,
    title: "chore: upstream updates available",
    state: "open",
  }
  const calls = []
  const request = async (path, init = {}) => {
    calls.push({ path, init })
    if (path.includes("?state=open")) return [open]
    if (init.method === "PATCH") return { ...open, state: "closed" }
    throw new Error(`Unexpected request: ${path}`)
  }

  await syncTrackingIssue("owner/repo", "report", "close", request)

  assert.deepEqual(
    calls.map(({ path, init }) => [init.method ?? "GET", path]),
    [
      ["GET", "/repos/owner/repo/issues?state=open&per_page=100&page=1"],
      ["PATCH", "/repos/owner/repo/issues/37"],
    ],
  )
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    body: "report",
    state: "closed",
    state_reason: "completed",
  })
})

test("does nothing when no open tracking issue needs closing", async () => {
  const calls = []
  const request = async (path, init = {}) => {
    calls.push({ path, init })
    return []
  }

  await syncTrackingIssue("owner/repo", "report", "close", request)

  assert.deepEqual(
    calls.map(({ path, init }) => [init.method ?? "GET", path]),
    [["GET", "/repos/owner/repo/issues?state=open&per_page=100&page=1"]],
  )
})
