import assert from "node:assert/strict"
import test from "node:test"

import { nextAggregateCalver } from "./version-packages.mjs"

test("increments the aggregate patch within the same UTC month", () => {
  assert.equal(
    nextAggregateCalver("2026.8.0", new Date("2026-08-10T12:00:00Z")),
    "2026.8.1",
  )
  assert.equal(
    nextAggregateCalver("2026.8.9", new Date("2026-08-31T23:59:59Z")),
    "2026.8.10",
  )
})

test("resets the aggregate patch when the UTC month changes", () => {
  assert.equal(
    nextAggregateCalver("2026.8.9", new Date("2026-09-01T00:00:00Z")),
    "2026.9.0",
  )
  assert.equal(
    nextAggregateCalver("2026.12.3", new Date("2027-01-01T00:00:00Z")),
    "2027.1.0",
  )
})

test("rejects invalid aggregate versions and dates", () => {
  assert.throws(() => nextAggregateCalver("0.1.0"), /Invalid aggregate CalVer/)
  assert.throws(
    () => nextAggregateCalver("2026.08.0"),
    /Invalid aggregate CalVer/,
  )
  assert.throws(
    () => nextAggregateCalver("2026.8.0", new Date("invalid")),
    /Invalid release date/,
  )
})
