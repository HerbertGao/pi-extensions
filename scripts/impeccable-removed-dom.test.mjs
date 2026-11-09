import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

const sourcePath = new URL(
  "../packages/pi-impeccable/skills/impeccable/scripts/live-browser.js",
  import.meta.url,
)
const source = readFileSync(sourcePath, "utf8")

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `missing ${name}`)
  const open = source.indexOf("{", start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const ch = source[i]
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`unterminated ${name}`)
}

const removedAttr = source.match(/const REMOVED_ATTR = ("[^"]+"|'[^']+')/)
assert.ok(removedAttr, "REMOVED_ATTR declaration")

const harness = `
${removedAttr[0]};
${extractFunction("unwrapMixedContentTextNodes")}
${extractFunction("stripManualEditRuntimeState")}
${extractFunction("restoreRemovedElement")}

function stagedCard() {
  const parent = document.createElement("section")
  parent.id = "card"
  parent.setAttribute("contenteditable", "true")
  parent.setAttribute("data-impeccable-editable", "true")
  parent.setAttribute("data-impeccable-original-text", "Card")
  const child = document.createElement("p")
  child.id = "gone"
  child.setAttribute(REMOVED_ATTR, "body>section>p:nth-child(1)")
  child.textContent = "Remove me"
  const nested = document.createElement("span")
  nested.id = "nested"
  nested.setAttribute(REMOVED_ATTR, "body>section>p>span")
  nested.textContent = "nested"
  child.appendChild(nested)
  const keep = document.createElement("p")
  keep.id = "keep"
  keep.textContent = "Stay"
  parent.appendChild(child)
  parent.appendChild(keep)
  document.body.appendChild(parent)
  return { parent, child, nested }
}

const childRef = "body>section>p:nth-child(1)"
const { parent, child, nested } = stagedCard()
// Go selects an ancestor after the child was staged, then strips that live node.
const clone = parent.cloneNode(true)
stripManualEditRuntimeState(parent)
const liveAfterGo = {
  childConnected: child.isConnected,
  nestedConnected: nested.isConnected,
  childInParent: parent.contains(child),
  nestedInParent: parent.contains(nested),
  childAttr: child.getAttribute("data-impeccable-removed"),
  nestedAttr: nested.getAttribute("data-impeccable-removed"),
  editableStripped: !parent.hasAttribute("contenteditable")
    && !parent.hasAttribute("data-impeccable-editable")
    && !parent.hasAttribute("data-impeccable-original-text"),
  keepRemains: !!parent.querySelector("#keep"),
}
stripManualEditRuntimeState(clone)
const cloneAfterSerialize = {
  removedGone: !clone.querySelector("[data-impeccable-removed]") && !clone.querySelector("#gone"),
  keepRemains: !!clone.querySelector("#keep"),
  liveStillHasChild: parent.contains(child),
}
child.removeAttribute("data-impeccable-removed")
const afterUndo = {
  connected: child.isConnected,
  inParent: parent.contains(child),
  attr: child.getAttribute("data-impeccable-removed"),
}

const discarded = stagedCard()
stripManualEditRuntimeState(discarded.parent)
const matchesBeforeRestore = document.querySelectorAll("[data-impeccable-removed]").length
restoreRemovedElement({ ref: childRef, removeElement: true })
const afterDiscard = {
  matchesBeforeRestore,
  childConnected: discarded.child.isConnected,
  childInParent: discarded.parent.contains(discarded.child),
  childAttr: discarded.child.getAttribute("data-impeccable-removed"),
  nestedAttr: discarded.nested.getAttribute("data-impeccable-removed"),
}

const removedRoot = document.createElement("aside")
removedRoot.id = "removed-root"
removedRoot.setAttribute("data-impeccable-removed", "body>aside")
removedRoot.textContent = "whole selection"
document.body.appendChild(removedRoot)
stripManualEditRuntimeState(removedRoot)

document.getElementById("out").textContent = JSON.stringify({
  liveAfterGo,
  cloneAfterSerialize,
  afterUndo,
  afterDiscard,
  removedRoot: {
    connected: removedRoot.isConnected,
    attr: removedRoot.getAttribute("data-impeccable-removed"),
  },
})
`

function dumpDom(url, profile) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "google-chrome",
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        `--user-data-dir=${profile}`,
        "--virtual-time-budget=500",
        "--dump-dom",
        url,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
    let out = ""
    let err = ""
    let sawResult = false
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error(`chrome dump timed out\n${err.slice(-500)}`))
    }, 15000)
    child.stdout.on("data", (buf) => {
      out += buf
      if (!sawResult && out.includes("</pre>")) {
        sawResult = true
        child.kill("SIGKILL")
      }
    })
    child.stderr.on("data", (buf) => {
      err += buf
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", () => {
      clearTimeout(timer)
      if (sawResult) resolve(out)
      else
        reject(
          new Error(`chrome closed without a DOM dump\n${err.slice(-500)}`),
        )
    })
  })
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function removeTree(path) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      rmSync(path, { recursive: true, force: true })
      return
    } catch (error) {
      if (
        attempt === 7 ||
        (error.code !== "ENOTEMPTY" &&
          error.code !== "EBUSY" &&
          error.code !== "EPERM")
      ) {
        throw error
      }
      sleepSync(40)
    }
  }
}

function decodeDump(html) {
  return html
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&")
}

test(
  "staged removal stays in the live DOM across Go, Undo, and Discard",
  { timeout: 20000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "impeccable-removed-"))
    const profile = mkdtempSync(join(tmpdir(), "impeccable-chrome-"))
    try {
      writeFileSync(join(dir, "harness.js"), harness)
      writeFileSync(
        join(dir, "page.html"),
        '<!doctype html><pre id="out"></pre><script src="harness.js"></script>',
      )
      const stdout = await dumpDom(
        pathToFileURL(join(dir, "page.html")).href,
        profile,
      )
      const raw = stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/)?.[1]
      assert.ok(raw, stdout.slice(0, 500))
      const report = JSON.parse(decodeDump(raw))

      assert.deepEqual(report.liveAfterGo, {
        childConnected: true,
        nestedConnected: true,
        childInParent: true,
        nestedInParent: true,
        childAttr: "body>section>p:nth-child(1)",
        nestedAttr: "body>section>p>span",
        editableStripped: true,
        keepRemains: true,
      })
      assert.deepEqual(report.cloneAfterSerialize, {
        removedGone: true,
        keepRemains: true,
        liveStillHasChild: true,
      })
      assert.deepEqual(report.afterUndo, {
        connected: true,
        inParent: true,
        attr: null,
      })
      assert.equal(report.afterDiscard.matchesBeforeRestore >= 2, true)
      assert.deepEqual(
        {
          childConnected: report.afterDiscard.childConnected,
          childInParent: report.afterDiscard.childInParent,
          childAttr: report.afterDiscard.childAttr,
          nestedAttr: report.afterDiscard.nestedAttr,
        },
        {
          childConnected: true,
          childInParent: true,
          childAttr: null,
          nestedAttr: "body>section>p>span",
        },
      )
      assert.deepEqual(report.removedRoot, {
        connected: true,
        attr: "body>aside",
      })
    } finally {
      removeTree(dir)
      removeTree(profile)
    }
  },
)
