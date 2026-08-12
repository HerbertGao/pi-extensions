#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const packageRoot = resolve(root, "packages")
const aggregatePath = resolve(packageRoot, "pi-extensions/package.json")
const monitorPath = resolve(root, "upstreams.json")
const issueTitle = "chore: upstream updates available"

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    throw new Error(`Could not parse ${path}: ${error.message}`, {
      cause: error,
    })
  }
}

function packageManifests() {
  return readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readJson(resolve(packageRoot, entry.name, "package.json")))
}

function githubSlug(repository) {
  let url
  try {
    url = new URL(repository)
  } catch (error) {
    throw new Error(`Invalid GitHub repository URL: ${repository}`, {
      cause: error,
    })
  }
  if (url.hostname !== "github.com")
    throw new Error(`Not a GitHub URL: ${repository}`)
  const parts = url.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean)
  if (parts.length !== 2)
    throw new Error(`Invalid GitHub repository: ${repository}`)
  return `${parts[0]}/${parts[1]}`
}

function validate(manifests, monitor, aggregate) {
  const errors = []
  const derived = manifests
    .filter((manifest) => manifest.name !== "@herbertgao/pi-extensions")
    .map((manifest) => {
      const upstream = manifest["x-upstream"] ?? {}
      return {
        localPackage: manifest.name,
        package: upstream.package,
        version: upstream.version,
        repository: upstream.repository,
        commit: upstream.commit,
      }
    })

  for (const entry of derived) {
    if (
      !entry.package ||
      !entry.version ||
      !entry.repository ||
      !entry.commit
    ) {
      errors.push(
        `${entry.localPackage} must declare complete x-upstream metadata`,
      )
    }
  }

  const repositoryUrls = new Set(
    monitor.repositories.map((entry) => entry.repository),
  )
  for (const entry of derived) {
    if (entry.repository && !repositoryUrls.has(entry.repository)) {
      errors.push(
        `${entry.localPackage} upstream repository is missing from upstreams.json`,
      )
    }
  }

  const companionNames = new Set()
  for (const companion of monitor.companions) {
    if (companionNames.has(companion.package)) {
      errors.push(`Duplicate companion ${companion.package}`)
    }
    companionNames.add(companion.package)
    if (!aggregate.dependencies?.[companion.package]) {
      errors.push(`${companion.package} is missing from aggregate dependencies`)
    }
    if (!aggregate.bundledDependencies?.includes(companion.package)) {
      errors.push(
        `${companion.package} is missing from aggregate bundledDependencies`,
      )
    }
  }

  for (const repository of monitor.repositories) {
    try {
      githubSlug(repository.repository)
    } catch (error) {
      errors.push(error.message)
    }
    if (!/^[0-9a-f]{40}$/.test(repository.reviewedCommit)) {
      errors.push(`${repository.name} reviewedCommit must be a full SHA`)
    }
  }

  return { derived, errors }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `${response.status} ${response.statusText}: ${body.slice(0, 200)}`,
    )
  }
  return response.json()
}

async function latestNpmVersion(packageName) {
  const encoded = packageName.replaceAll("/", "%2F")
  const metadata = await fetchJson(
    `https://registry.npmjs.org/${encoded}/latest`,
    {
      headers: { Accept: "application/json" },
    },
  )
  if (typeof metadata.version !== "string") {
    throw new Error(`npm latest metadata for ${packageName} has no version`)
  }
  return metadata.version
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "HerbertGao-pi-extensions-upstream-monitor",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

async function latestGitHubCommit(repository) {
  const commits = await fetchJson(
    `https://api.github.com/repos/${githubSlug(repository)}/commits?per_page=1`,
    { headers: githubHeaders() },
  )
  const sha = commits?.[0]?.sha
  if (typeof sha !== "string")
    throw new Error(`No default-branch commit for ${repository}`)
  return sha
}

function markdownReport({
  derived,
  companions,
  repositories,
  releaseUpdates,
  repositoryUpdates,
  errors,
}) {
  const lines = [
    "<!-- upstream-monitor -->",
    "# Upstream monitor",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Imported package baselines",
    "",
    "| Local package | Upstream package | Imported version | Imported commit |",
    "| --- | --- | --- | --- |",
  ]

  for (const entry of derived.toSorted((a, b) =>
    a.localPackage.localeCompare(b.localPackage),
  )) {
    lines.push(
      `| \`${entry.localPackage}\` | [\`${entry.package}\`](${entry.repository}) | \`${entry.version}\` | \`${entry.commit.slice(0, 12)}\` |`,
    )
  }

  lines.push(
    "",
    "## Bundled companion pins",
    "",
    "| Package | Pinned version | Upstream |",
    "| --- | --- | --- |",
  )
  for (const entry of companions.toSorted((a, b) =>
    a.package.localeCompare(b.package),
  )) {
    lines.push(
      `| \`${entry.package}\` | \`${entry.version}\` | [repository](${entry.repository}) |`,
    )
  }

  lines.push("", "## Release updates", "")
  if (releaseUpdates.length === 0) {
    lines.push("No upstream releases detected.")
  } else {
    for (const update of releaseUpdates) lines.push(`- ${update}`)
  }

  lines.push("", "## Unreleased repository commits", "")
  if (repositoryUpdates.length === 0) {
    lines.push("No commits after the review cursors.")
  } else {
    for (const update of repositoryUpdates) lines.push(`- ${update}`)
  }

  if (repositories.length > 0) {
    lines.push("", "## Repository review cursors", "")
    for (const entry of repositories) {
      lines.push(
        `- [${entry.name}](${entry.repository}): reviewed \`${entry.reviewedCommit.slice(0, 12)}\`, current \`${entry.latestCommit.slice(0, 12)}\``,
      )
    }
  }

  if (errors.length > 0) {
    lines.push("", "## Monitor errors", "")
    for (const error of errors) lines.push(`- ${error}`)
  }

  return `${lines.join("\n")}\n`
}

async function githubRequest(path, init = {}) {
  return fetchJson(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...githubHeaders(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  })
}

export function issueSyncAction(releaseUpdates, errors) {
  if (releaseUpdates.length > 0) return "open"
  if (errors.length > 0) return "unchanged"
  return "close"
}

async function syncIssue(report, action) {
  const repository = process.env.GITHUB_REPOSITORY
  if (!process.env.GITHUB_TOKEN || !repository) {
    throw new Error("--sync-issue requires GITHUB_TOKEN and GITHUB_REPOSITORY")
  }

  const issues = await githubRequest(
    `/repos/${repository}/issues?state=all&per_page=100`,
  )
  const issue = issues.find(
    (candidate) => !candidate.pull_request && candidate.title === issueTitle,
  )

  if (action === "open") {
    const body = JSON.stringify({
      title: issueTitle,
      body: report,
      state: "open",
    })
    if (issue) {
      await githubRequest(`/repos/${repository}/issues/${issue.number}`, {
        method: "PATCH",
        body,
      })
    } else {
      await githubRequest(`/repos/${repository}/issues`, {
        method: "POST",
        body,
      })
    }
  } else if (action === "close" && issue?.state === "open") {
    await githubRequest(`/repos/${repository}/issues/${issue.number}`, {
      method: "PATCH",
      body: JSON.stringify({
        body: report,
        state: "closed",
        state_reason: "completed",
      }),
    })
  }
}

async function main() {
  const validateOnly = process.argv.includes("--validate")
  const shouldSyncIssue = process.argv.includes("--sync-issue")
  const manifests = packageManifests()
  const monitor = readJson(monitorPath)
  const aggregate = readJson(aggregatePath)
  const { derived, errors } = validate(manifests, monitor, aggregate)

  if (validateOnly) {
    if (errors.length > 0) throw new Error(errors.join("\n"))
    process.stdout.write(
      `Validated ${derived.length} derived packages and ${monitor.companions.length} companions.\n`,
    )
    return
  }

  const releaseUpdates = []
  const repositoryUpdates = []
  const companionReport = monitor.companions.map((entry) => ({
    package: entry.package,
    repository: entry.repository,
    version: aggregate.dependencies[entry.package],
  }))

  await Promise.all(
    derived.map(async (entry) => {
      try {
        const latest = await latestNpmVersion(entry.package)
        if (latest !== entry.version) {
          releaseUpdates.push(
            `\`${entry.localPackage}\`: upstream npm \`${entry.package}\` is \`${latest}\` (imported \`${entry.version}\`).`,
          )
        }
      } catch (error) {
        errors.push(`npm ${entry.package}: ${error.message}`)
      }
      return undefined
    }),
  )

  await Promise.all(
    companionReport.map(async (entry) => {
      try {
        const latest = await latestNpmVersion(entry.package)
        if (latest !== entry.version) {
          releaseUpdates.push(
            `\`${entry.package}\`: npm is \`${latest}\` (pinned \`${entry.version}\`).`,
          )
        }
      } catch (error) {
        errors.push(`npm ${entry.package}: ${error.message}`)
      }
      return undefined
    }),
  )

  const repositoryReport = await Promise.all(
    monitor.repositories.map(async (entry) => {
      try {
        const latestCommit = await latestGitHubCommit(entry.repository)
        if (latestCommit !== entry.reviewedCommit) {
          repositoryUpdates.push(
            `[${entry.name}](${entry.repository}/compare/${entry.reviewedCommit}...${latestCommit}) has commits after the review cursor.`,
          )
        }
        return {
          name: entry.name,
          repository: entry.repository,
          reviewedCommit: entry.reviewedCommit,
          latestCommit,
        }
      } catch (error) {
        errors.push(`GitHub ${entry.repository}: ${error.message}`)
        return {
          name: entry.name,
          repository: entry.repository,
          reviewedCommit: entry.reviewedCommit,
          latestCommit: entry.reviewedCommit,
        }
      }
    }),
  )

  releaseUpdates.sort((a, b) => a.localeCompare(b))
  repositoryUpdates.sort((a, b) => a.localeCompare(b))
  errors.sort((a, b) => a.localeCompare(b))
  const report = markdownReport({
    derived,
    companions: companionReport,
    repositories: repositoryReport,
    releaseUpdates,
    repositoryUpdates,
    errors,
  })
  process.stdout.write(report)

  if (shouldSyncIssue) {
    await syncIssue(report, issueSyncAction(releaseUpdates, errors))
  }
  if (errors.length > 0) process.exitCode = 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    process.exitCode = 1
  })
}
