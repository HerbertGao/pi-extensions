import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { parseHTML } from "linkedom"
import test from "node:test"

const source = readFileSync(
  new URL(
    "../packages/pi-impeccable/skills/impeccable/scripts/live-browser.js",
    import.meta.url,
  ),
  "utf8",
)

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
const unwrapMixedContentTextNodes = extractFunction(
  "unwrapMixedContentTextNodes",
)
const productionStrip = extractFunction("stripManualEditRuntimeState")
const restoreRemovedElement = extractFunction("restoreRemovedElement")

// The published helper still drops every marked descendant before asking
// whether the root is the live page. 4.9.1 leaves that function identical to
// 4.8.2. Replaying the unconditional removal against the same assertions is
// the regression.
function published482Strip(stripSource) {
  const guarded = /if \(!root\.isConnected\) \{\n([\s\S]*?)\n {4}\}/
  const match = stripSource.match(guarded)
  assert.ok(match, "the shipped helper must keep the live-page guard")
  const unguarded = stripSource.replace(
    guarded,
    match[1].replace(/^ {2}/gm, ""),
  )
  assert.doesNotMatch(unguarded, /isConnected/)
  assert.match(unguarded, /removed\.remove\(\)/)
  return unguarded
}

const childRef = "body>section>p:nth-child(1)"
const nestedRef = "body>section>p>span"

function runReport(stripSource) {
  const { document } = parseHTML("<!doctype html><html><body></body></html>")
  const run = new Function(
    "document",
    `
    ${removedAttr[0]};
    ${unwrapMixedContentTextNodes}
    ${stripSource}
    ${restoreRemovedElement}
    function stagedCard() {
      const parent = document.createElement("section")
      parent.id = "card"
      parent.setAttribute("contenteditable", "true")
      parent.setAttribute("data-impeccable-editable", "true")
      parent.setAttribute("data-impeccable-original-text", "Card")
      const child = document.createElement("p")
      child.id = "gone"
      child.setAttribute(REMOVED_ATTR, ${JSON.stringify(childRef)})
      child.textContent = "Remove me"
      const nested = document.createElement("span")
      nested.id = "nested"
      nested.setAttribute(REMOVED_ATTR, ${JSON.stringify(nestedRef)})
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
    const { parent, child, nested } = stagedCard()
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
    restoreRemovedElement({ ref: ${JSON.stringify(childRef)}, removeElement: true })
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
    stripManualEditRuntimeState(removedRoot);
    return ({
      liveAfterGo,
      cloneAfterSerialize,
      afterUndo,
      afterDiscard,
      removedRoot: {
        connected: removedRoot.isConnected,
        attr: removedRoot.getAttribute("data-impeccable-removed"),
      },
    })
  `,
  )
  return run(document)
}

function assertRemovalContract(report) {
  assert.deepEqual(report.liveAfterGo, {
    childConnected: true,
    nestedConnected: true,
    childInParent: true,
    nestedInParent: true,
    childAttr: childRef,
    nestedAttr: nestedRef,
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
      nestedAttr: nestedRef,
    },
  )
  assert.deepEqual(report.removedRoot, {
    connected: true,
    attr: "body>aside",
  })
}

test("staged removal stays in the live DOM across Go, Undo, and Discard", () => {
  assertRemovalContract(runReport(productionStrip))
})

test("the published strip fails those same live-removal assertions", () => {
  const report = runReport(published482Strip(productionStrip))
  assert.equal(report.liveAfterGo.childConnected, false)
  assert.equal(report.liveAfterGo.nestedConnected, false)
  assert.equal(report.liveAfterGo.childInParent, false)
  assert.equal(report.liveAfterGo.nestedInParent, false)
  assert.equal(report.liveAfterGo.childAttr, childRef)
  assert.equal(report.liveAfterGo.editableStripped, true)
  assert.throws(() => assertRemovalContract(report), assert.AssertionError)
})
