import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { spawnSync } from "node:child_process"
import test from "node:test"

function workflow(name) {
  const result = spawnSync(
    "bun",
    [
      "-e",
      "console.log(JSON.stringify(Bun.YAML.parse(await Bun.stdin.text())))",
    ],
    {
      input: readFileSync(
        new URL(`../.github/workflows/${name}.yml`, import.meta.url),
        "utf8",
      ),
      encoding: "utf8",
    },
  )
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

const ci = workflow("ci")
const release = workflow("release")
const checks = workflow("checks")

test("PRs and master pushes each run the shared validation once", () => {
  assert.deepEqual(Object.keys(ci.on), ["pull_request"])
  assert.deepEqual(release.on, { push: { branches: ["master"] } })
  assert.deepEqual(Object.keys(checks.on), ["workflow_call"])

  for (const caller of [ci, release]) {
    assert.deepEqual(caller.permissions, { contents: "read" })
    assert.deepEqual(caller.jobs.validate, {
      uses: "./.github/workflows/checks.yml",
    })
  }
  assert.deepEqual(checks.permissions, { contents: "read" })
})

test("independent matrix runners preserve every command in bun run check", () => {
  const suite = checks.jobs.suite
  assert.deepEqual(suite.strategy, {
    "fail-fast": false,
    matrix: { suite: ["unit", "aggregate"] },
  })
  const commands = ["unit", "aggregate"].flatMap((name) => {
    const steps = suite.steps.filter(
      (step) => step.if === `matrix.suite == '${name}'`,
    )
    assert.equal(steps.length, 1)
    return steps[0].run.trim().split("\n")
  })
  const { scripts } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  )
  assert.deepEqual(commands.toSorted(), scripts.check.split(" && ").toSorted())
  const aggregate = suite.steps.find(
    (step) => step.if === "matrix.suite == 'aggregate'",
  )
  assert.ok(aggregate.env.AGGREGATE_SMOKE_ARTIFACT_DIR)
  assert.ok(
    suite.steps.some(
      (step) => step.if === "failure() && matrix.suite == 'aggregate'",
    ),
  )
})

test("the stable check gate fails on failed, cancelled or skipped validation", () => {
  for (const caller of [ci, release]) {
    const gate = caller.jobs.check
    assert.equal(gate.name ?? "check", "check")
    assert.equal(gate.if, "always()")
    assert.equal(gate.needs, "validate")
    assert.equal(gate.steps.length, 1)
    assert.deepEqual(gate.steps[0].env, {
      VALIDATION_RESULT: "${{ needs.validate.result }}",
    })
    for (const result of ["success", "failure", "cancelled", "skipped", ""]) {
      const executed = spawnSync("bash", ["-c", gate.steps[0].run], {
        env: { ...process.env, VALIDATION_RESULT: result },
      })
      assert.equal(executed.status, result === "success" ? 0 : 1)
    }
  }
})

test("only the gated release job retains publishing permissions and commands", () => {
  assert.equal(release.concurrency, "${{ github.workflow }}-${{ github.ref }}")
  assert.equal(release.jobs.validate.if, undefined)
  const publish = release.jobs.release
  assert.equal(publish.needs, "check")
  assert.equal(publish.if, "vars.NPM_RELEASE_ENABLED == 'true'")
  assert.deepEqual(publish.permissions, {
    contents: "write",
    "pull-requests": "write",
    "id-token": "write",
  })
  const changesets = publish.steps.find((step) => step.id === "changesets")
  assert.equal(changesets.with.version, "bun run version")
  assert.equal(changesets.with.publish, "bun run release")
  assert.equal(changesets.env.NPM_CONFIG_PROVENANCE, "true")
  assert.ok(
    publish.steps.some(
      (step) =>
        step.if ===
          "always() && steps.changesets.outputs.published == 'true'" &&
        step.run === "node scripts/verify-published-packages.mjs",
    ),
  )
  assert.ok(publish.steps.every((step) => step.run !== "bun run check"))
})

test("reviewed upstream upgrade is retired and the monitor only syncs issues", () => {
  const active = readdirSync(new URL("../.github/workflows/", import.meta.url))
  assert.deepEqual(
    active.filter((name) => name.includes("upstream-upgrade")),
    [],
  )

  const archived = readdirSync(
    new URL(
      "../.github/workflows-disabled/reviewed-upstream-upgrade/",
      import.meta.url,
    ),
  )
  for (const name of [
    "README.md",
    "upstream-upgrade.md",
    "upstream-upgrade.lock.yml",
    "upstream-upgrade-agy.md",
    "upstream-upgrade-agy.lock.yml",
  ]) {
    assert.ok(archived.includes(name), name)
  }

  const monitor = workflow("upstream-monitor")
  assert.deepEqual(monitor.permissions, {
    contents: "read",
    issues: "write",
  })
  assert.deepEqual(monitor.on.schedule, [{ cron: "17 1 * * *" }])
  assert.ok(Object.hasOwn(monitor.on, "workflow_dispatch"))
  assert.equal(monitor.jobs.check.env, undefined)
  const runs = monitor.jobs.check.steps
    .map((step) => step.run)
    .filter((run) => run !== undefined)
  assert.equal(runs.length, 1)
  assert.match(runs[0], /node scripts\/check-upstreams\.mjs --sync-issue/)

  const source = readFileSync(
    new URL("../.github/workflows/upstream-monitor.yml", import.meta.url),
    "utf8",
  )
  for (const forbidden of [
    "UPGRADE_DISPATCH",
    "workflow run",
    "COPILOT_GITHUB_TOKEN",
    "GH_AW_CI_TRIGGER_TOKEN",
    "actions: write",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden)
  }
})
