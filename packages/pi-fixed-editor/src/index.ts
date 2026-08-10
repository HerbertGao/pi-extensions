import {
  copyToClipboard,
  type ExtensionAPI,
  type ExtensionContext,
  VERSION,
} from "@earendil-works/pi-coding-agent"
import type { Component } from "@earendil-works/pi-tui"
import { visibleWidth } from "@earendil-works/pi-tui"
import { renderFixedEditorCluster } from "./cluster.js"
import {
  emergencyTerminalModeReset,
  TerminalSplitCompositor,
  type TerminalLike,
} from "./terminal-split.js"
import { getPiSupport } from "./version.js"

const WIDGET_KEY = "pi-fixed-editor-probe"
const WARNING_MESSAGE = "pi-fixed-editor: unsupported Pi TUI layout"
const UPGRADE_MESSAGE =
  "pi-fixed-editor is deprecated. Upgrade Pi to 0.84.1 or newer, enable fullscreen mode, then uninstall this package."
const NATIVE_FULLSCREEN_MESSAGE =
  "pi-fixed-editor is deprecated. Enable Pi's fullscreen mode, then uninstall this package."

const PI_SUPPORT = getPiSupport(VERSION)

interface ContainerLike extends Component {
  children: Component[]
}

interface TuiLike {
  children: Component[]
  terminal?: TerminalLike
  focusedComponent?: Component | null
  requestRender: (force?: boolean) => void
  getShowHardwareCursor?: () => boolean
}

interface ContainerMatch {
  container: ContainerLike
  index: number
}

let compositor: TerminalSplitCompositor | null = null
let isInstalled = false
let didWarnUnsupported = false
let fixedStatusContainer: Component | null = null
let fixedWidgetContainerAbove: Component | null = null
let fixedEditorContainer: Component | null = null
let fixedWidgetContainerBelow: Component | null = null
let fixedFooterContainer: Component | null = null

class ProbeComponent implements Component {
  private readonly install: () => void
  private hasQueuedInstall = false

  constructor(onInstall: () => void) {
    this.install = onInstall
  }

  render(): string[] {
    if (!this.hasQueuedInstall) {
      this.hasQueuedInstall = true
      queueMicrotask(this.install)
    }
    return []
  }

  invalidate(): void {
    this.hasQueuedInstall = false
  }
}

function isContainerLike(value: unknown): value is ContainerLike {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(Reflect.get(value, "children")) &&
    typeof Reflect.get(value, "render") === "function"
  )
}

function isRenderable(value: unknown): value is Component {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "render") === "function" &&
    typeof Reflect.get(value, "invalidate") === "function"
  )
}

function getTuiChildren(tui: TuiLike): Component[] {
  return Array.isArray(tui.children) ? tui.children : []
}

function findContainerWithChild(
  tui: TuiLike,
  child: Component,
): ContainerMatch | null {
  const children = getTuiChildren(tui)
  const index = children.findIndex(
    (candidate) =>
      isContainerLike(candidate) && candidate.children.includes(child),
  )
  if (index === -1) return null

  const container = children[index]
  return isContainerLike(container) ? { container, index } : null
}

function findEditorContainer(tui: TuiLike): ContainerMatch | null {
  const focusedComponent = Reflect.get(tui, "focusedComponent")
  if (isRenderable(focusedComponent)) {
    const match = findContainerWithChild(tui, focusedComponent)
    if (match) return match
  }

  const children = getTuiChildren(tui)
  const index = children.findIndex((candidate) => {
    if (!isContainerLike(candidate)) return false
    return candidate.children.some((child) => {
      return (
        typeof Reflect.get(child, "getText") === "function" &&
        typeof Reflect.get(child, "setText") === "function" &&
        typeof Reflect.get(child, "handleInput") === "function"
      )
    })
  })

  if (index === -1) return null
  const container = children[index]
  return isContainerLike(container) ? { container, index } : null
}

function renderHidden(
  activeCompositor: TerminalSplitCompositor,
  component: Component | null,
  width: number,
): string[] {
  if (!component) return []
  return activeCompositor
    .renderHidden(component, width)
    .filter((line) => visibleWidth(line) > 0)
}

function resetContainers(): void {
  fixedStatusContainer = null
  fixedWidgetContainerAbove = null
  fixedEditorContainer = null
  fixedWidgetContainerBelow = null
  fixedFooterContainer = null
}

function teardown(options?: { resetExtendedKeyboardModes?: boolean }): void {
  const hadCompositor = compositor !== null
  compositor?.dispose(options)
  if (!hadCompositor && options?.resetExtendedKeyboardModes) {
    try {
      process.stdout.write(emergencyTerminalModeReset())
    } catch {
      // Exit cleanup cannot surface useful terminal write failures.
    }
  }
  compositor = null
  isInstalled = false
  resetContainers()
}

function warnUnsupported(ctx: ExtensionContext): void {
  if (didWarnUnsupported || ctx.mode !== "tui") return
  didWarnUnsupported = true
  ctx.ui.notify(WARNING_MESSAGE, "warning")
}

function install(ctx: ExtensionContext, tui: TuiLike): void {
  if (isInstalled || compositor) return
  if (ctx.mode !== "tui") return

  const terminal = tui.terminal
  if (!terminal || typeof terminal.write !== "function") {
    warnUnsupported(ctx)
    return
  }

  const editorMatch = findEditorContainer(tui)
  if (!editorMatch) {
    warnUnsupported(ctx)
    return
  }

  const children = getTuiChildren(tui)
  fixedStatusContainer = children[editorMatch.index - 2] ?? null
  fixedWidgetContainerAbove = children[editorMatch.index - 1] ?? null
  fixedEditorContainer = editorMatch.container
  fixedWidgetContainerBelow = children[editorMatch.index + 1] ?? null
  fixedFooterContainer = children[editorMatch.index + 2] ?? null

  let nextCompositor: TerminalSplitCompositor
  nextCompositor = new TerminalSplitCompositor({
    tui,
    terminal,
    onCopySelection: (text) => {
      void copyToClipboard(text)
    },
    getShowHardwareCursor: () =>
      typeof tui.getShowHardwareCursor === "function" &&
      tui.getShowHardwareCursor(),
    renderCluster: (width, terminalRows) =>
      renderFixedEditorCluster({
        width,
        terminalRows,
        statusLines: renderHidden(nextCompositor, fixedStatusContainer, width),
        aboveWidgetLines: renderHidden(
          nextCompositor,
          fixedWidgetContainerAbove,
          width,
        ),
        editorLines: renderHidden(nextCompositor, fixedEditorContainer, width),
        belowWidgetLines: renderHidden(
          nextCompositor,
          fixedWidgetContainerBelow,
          width,
        ),
        footerLines: renderHidden(nextCompositor, fixedFooterContainer, width),
      }),
  })

  compositor = nextCompositor
  if (fixedStatusContainer) nextCompositor.hideRenderable(fixedStatusContainer)
  if (fixedWidgetContainerAbove)
    nextCompositor.hideRenderable(fixedWidgetContainerAbove)
  if (fixedEditorContainer) nextCompositor.hideRenderable(fixedEditorContainer)
  if (fixedWidgetContainerBelow)
    nextCompositor.hideRenderable(fixedWidgetContainerBelow)
  if (fixedFooterContainer) nextCompositor.hideRenderable(fixedFooterContainer)

  try {
    nextCompositor.install()
    isInstalled = true
    tui.requestRender(true)
  } catch {
    teardown({ resetExtendedKeyboardModes: true })
    warnUnsupported(ctx)
  }
}

export default function fixedEditor(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    didWarnUnsupported = false
    if (ctx.mode !== "tui") return

    if (PI_SUPPORT !== "legacy") {
      ctx.ui.notify(
        PI_SUPPORT === "upgrade" ? UPGRADE_MESSAGE : NATIVE_FULLSCREEN_MESSAGE,
        "warning",
      )
      return
    }

    ctx.ui.setWidget(
      WIDGET_KEY,
      (tui) => {
        const tuiLike = tui as unknown as TuiLike
        return new ProbeComponent(() => install(ctx, tuiLike))
      },
      { placement: "aboveEditor" },
    )
  })

  pi.on("session_shutdown", (_event, ctx) => {
    if (PI_SUPPORT !== "legacy") return

    if (ctx.mode === "tui") {
      ctx.ui.setWidget(WIDGET_KEY, undefined)
    }
    teardown({ resetExtendedKeyboardModes: true })
  })
}
