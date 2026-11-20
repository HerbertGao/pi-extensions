import { spawn } from "node:child_process"
import { delimiter, dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

// Keep the latest dist-tag on prerelease versions such as 1.0.2-local.1.
export const CHANGESET_PUBLISH_ARGS = ["publish", "--tag", "latest"]

export const STAGED_PUBLISH_NOTICE =
  "npm E409: this version is already staged or accepted (Cannot publish over previously staged version). Treating the publish as already published and continuing to verify. Do not bump versions."

export function isPreviouslyStagedPublishFailure(output) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
  const text = String(output ?? "").replace(ansi, "")
  const stagedVersion = /cannot publish over previously staged version/i
  if (!stagedVersion.test(text) || !/\bE409\b/.test(text)) return false

  const npmCodes = [
    ...text.matchAll(/npm (?:error|ERR!) code ([A-Za-z0-9]+)/gi),
  ].map((match) => match[1].toUpperCase())
  if (npmCodes.some((code) => code !== "E409")) return false

  const failures = [
    ...text.matchAll(/an error occurred while publishing[^\n]*/gi),
  ].map((match) => match[0])
  return failures.every(
    (line) => stagedVersion.test(line) && /\bE409\b/.test(line),
  )
}

export function resolvePublishExitCode(status, output) {
  if (status === 0) return 0
  if (typeof status === "number" && isPreviouslyStagedPublishFailure(output)) {
    return 0
  }
  return typeof status === "number" ? status : 1
}

function runChangesetPublish() {
  return new Promise((resolveRun, reject) => {
    const child = spawn("changeset", CHANGESET_PUBLISH_ARGS, {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${join(root, "node_modules", ".bin")}${delimiter}${process.env.PATH ?? ""}`,
      },
      stdio: ["inherit", "pipe", "pipe"],
    })
    // The E409 text is at the end of the publish log. Keep a rolling tail so
    // a large provenance publish cannot drop it, without buffering the whole
    // log in memory.
    const maxCapture = 1024 * 1024
    let output = ""
    const capture = (chunk, stream) => {
      stream.write(chunk)
      output = (output + chunk).slice(-maxCapture)
    }

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => capture(chunk, process.stdout))
    child.stderr.on("data", (chunk) => capture(chunk, process.stderr))
    child.on("error", reject)
    child.on("close", (status) => resolveRun({ status, output }))
  })
}

async function main() {
  const { status, output } = await runChangesetPublish()
  const code = resolvePublishExitCode(status, output)
  if (code === 0 && status !== 0)
    process.stderr.write(`${STAGED_PUBLISH_NOTICE}\n`)
  process.exit(code)
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    process.exit(1)
  })
}
