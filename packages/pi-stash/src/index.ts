import type {
  ExtensionAPI,
  ExtensionContext,
  InputSource,
  SessionEntry,
} from "@earendil-works/pi-coding-agent"

export const STASH_ENTRY_TYPE = "pi-stash-state"
export const STASH_SHORTCUT = "alt+s"

interface StashState {
  draft: string | null
}

export type ShortcutAction =
  | { type: "none" }
  | { type: "reject" }
  | { type: "restore"; draft: string }
  | { type: "stash"; draft: string }

export function getShortcutAction(
  editorText: string,
  pendingDraft: string | null,
): ShortcutAction {
  if (pendingDraft !== null) {
    return editorText.trim()
      ? { type: "reject" }
      : { type: "restore", draft: pendingDraft }
  }

  return editorText.trim()
    ? { type: "stash", draft: editorText }
    : { type: "none" }
}

export function shouldAutoRestore(source: InputSource, text: string) {
  return source === "interactive" && !text.trimStart().startsWith("/")
}

export function getPendingDraft(
  entries: readonly SessionEntry[],
): string | null {
  let draft: string | null = null

  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== STASH_ENTRY_TYPE) {
      continue
    }

    const data = entry.data
    if (
      typeof data === "object" &&
      data !== null &&
      "draft" in data &&
      (typeof data.draft === "string" || data.draft === null)
    ) {
      draft = data.draft
    }
  }

  return draft
}

export default function stashExtension(pi: ExtensionAPI) {
  let pendingDraft: string | null = null

  function saveDraft(draft: string | null) {
    pendingDraft = draft
    pi.appendEntry<StashState>(STASH_ENTRY_TYPE, { draft })
  }

  function restoreDraft(ctx: ExtensionContext) {
    if (pendingDraft === null) return

    const draft = pendingDraft
    ctx.ui.setEditorText(draft)
    saveDraft(null)
    ctx.ui.notify("Draft restored", "info")
  }

  pi.on("session_start", (_event, ctx) => {
    pendingDraft = getPendingDraft(ctx.sessionManager.getBranch())
    if (
      ctx.mode === "tui" &&
      pendingDraft !== null &&
      !ctx.ui.getEditorText().trim()
    ) {
      restoreDraft(ctx)
    }
  })

  pi.on("input", (event, ctx) => {
    if (shouldAutoRestore(event.source, event.text)) restoreDraft(ctx)
  })

  pi.registerShortcut(STASH_SHORTCUT, {
    description: "Stash or restore the current draft",
    handler: (ctx) => {
      const action = getShortcutAction(ctx.ui.getEditorText(), pendingDraft)

      switch (action.type) {
        case "stash":
          saveDraft(action.draft)
          ctx.ui.setEditorText("")
          ctx.ui.notify("Draft stashed", "info")
          break
        case "restore":
          restoreDraft(ctx)
          break
        case "reject":
          ctx.ui.notify("A draft is already stashed", "warning")
          break
        case "none":
          break
      }
    },
  })
}
