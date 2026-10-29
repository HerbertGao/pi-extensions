import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  findOpenTrackingIssue,
  issueSyncAction,
  npmTrackedRepositories,
  readPinRequirement,
  recordPypiRelease,
  syncTrackingIssue,
  trackingReportFingerprint,
  validate,
} from "./check-upstreams.mjs"

test("npm-published repositories are not commit-watched", () => {
  const tracked = npmTrackedRepositories([
    { repository: "https://github.com/minuque/pi-cc-extensions", watch: "npm" },
    { repository: "https://github.com/NVlabs/SoL-Pi", watch: "commits" },
  ])
  assert.equal(tracked.has("https://github.com/minuque/pi-cc-extensions"), true)
  assert.equal(tracked.has("https://github.com/NVlabs/SoL-Pi"), false)
})

test("a newer graphifyy release opens the tracking issue", () => {
  const pinned = readPinRequirement(
    readFileSync(new URL("../pins/graphifyy", import.meta.url), "utf8"),
    "graphifyy",
  )
  assert.equal(pinned, "0.9.97")

  const releaseUpdates = []
  const errors = []
  recordPypiRelease(
    releaseUpdates,
    errors,
    { package: "graphifyy", version: pinned },
    "0.9.98",
  )
  assert.deepEqual(releaseUpdates, [
    "`graphifyy`: PyPI is `0.9.98` (pinned `0.9.97`).",
  ])
  assert.equal(issueSyncAction(releaseUpdates, errors), "open")

  const current = []
  recordPypiRelease(
    current,
    [],
    { package: "graphifyy", version: pinned },
    pinned,
  )
  assert.deepEqual(current, [])
  assert.equal(issueSyncAction(current, []), "close")

  const failed = []
  const fetchErrors = []
  recordPypiRelease(
    failed,
    fetchErrors,
    { package: "graphifyy", version: pinned },
    new Error("503"),
  )
  assert.deepEqual(failed, [])
  assert.equal(issueSyncAction(failed, fetchErrors), "unchanged")
  assert.throws(
    () => readPinRequirement("other==1.2.3\n", "graphifyy"),
    /expected graphifyy/,
  )
})

test("graphifyy is a pypi pin outside the npm aggregate", () => {
  const monitor = JSON.parse(
    readFileSync(new URL("../upstreams.json", import.meta.url), "utf8"),
  )
  const aggregate = JSON.parse(
    readFileSync(
      new URL("../packages/pi-extensions/package.json", import.meta.url),
      "utf8",
    ),
  )
  const graphify = monitor.pypi.find((entry) => entry.package === "graphifyy")
  assert.equal(graphify.watch, "pypi")
  assert.equal(graphify.pin, "pins/graphifyy")
  assert.equal(graphify.repository, "https://github.com/Graphify-Labs/graphify")

  const { errors, pypi } = validate([], monitor, aggregate)
  assert.deepEqual(errors, [])
  assert.deepEqual(
    pypi.map((entry) => [entry.package, entry.version, entry.watch]),
    [["graphifyy", "0.9.97", "pypi"]],
  )

  const vendored = validate([], monitor, {
    ...aggregate,
    dependencies: { ...aggregate.dependencies, graphifyy: "0.9.97" },
    bundledDependencies: [...aggregate.bundledDependencies, "graphifyy"],
  })
  assert.ok(
    vendored.errors.some((error) =>
      error.includes(
        "graphifyy is a PyPI pin and must stay out of the npm aggregate",
      ),
    ),
  )
})

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
