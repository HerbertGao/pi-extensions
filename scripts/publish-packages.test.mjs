import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  CHANGESET_PUBLISH_ARGS,
  STAGED_PUBLISH_NOTICE,
  isPreviouslyStagedPublishFailure,
  resolvePublishExitCode,
} from "./publish-packages.mjs"

const stagedPublish = `
an error occurred while publishing @herbertgao/pi-extensions: E409 409 Conflict - PUT https://registry.npmjs.org/@herbertgao%2fpi-extensions - Cannot publish over previously staged version "2026.11.18".
npm notice publish Provenance statement published to transparency log: https://search.sigstore.dev/?logIndex=1
npm error code E409
npm error 409 Conflict - PUT https://registry.npmjs.org/@herbertgao%2fpi-extensions - Cannot publish over previously staged version "2026.11.18".
packages failed to publish:
@herbertgao/pi-extensions@2026.11.18
`

test("release still publishes with the latest tag", () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  )
  assert.equal(scripts.release, "node scripts/publish-packages.mjs")
  assert.deepEqual(CHANGESET_PUBLISH_ARGS, ["publish", "--tag", "latest"])
})

test("npm E409 for a previously staged version is already published", () => {
  assert.equal(isPreviouslyStagedPublishFailure(stagedPublish), true)
  assert.equal(resolvePublishExitCode(1, stagedPublish), 0)
  assert.match(STAGED_PUBLISH_NOTICE, /already staged or accepted/)
  assert.match(STAGED_PUBLISH_NOTICE, /Do not bump versions/)
})

test("a previously staged failure still passes when color codes wrap the log", () => {
  const colored = stagedPublish.replace(
    "an error occurred",
    "\u001b[31merror\u001b[39m an error occurred",
  )
  assert.equal(resolvePublishExitCode(1, colored), 0)
})

test("older npm ERR output for a staged version is already published", () => {
  const legacy = `
npm ERR! code E409
npm ERR! 409 Conflict - Cannot publish over previously staged version "2026.11.18".
`
  assert.equal(resolvePublishExitCode(1, legacy), 0)
})

test("other publish failures still fail the release", () => {
  const auth = `
an error occurred while publishing @herbertgao/pi-bark: ENEEDAUTH This command requires you to be logged in.
npm error code ENEEDAUTH
packages failed to publish:
@herbertgao/pi-bark@0.1.0
`
  assert.equal(isPreviouslyStagedPublishFailure(auth), false)
  assert.equal(resolvePublishExitCode(1, auth), 1)

  const mixed = `${stagedPublish}\n${auth}`
  assert.equal(isPreviouslyStagedPublishFailure(mixed), false)
  assert.equal(resolvePublishExitCode(1, mixed), 1)
  assert.equal(resolvePublishExitCode(null, stagedPublish), 1)
})

test("a successful or no-op publish keeps its zero exit", () => {
  assert.equal(
    resolvePublishExitCode(0, "No unpublished projects to publish."),
    0,
  )
  assert.equal(
    resolvePublishExitCode(
      0,
      "@herbertgao/pi-extensions is not being published because version 2026.11.18 is already published on npm",
    ),
    0,
  )
})
