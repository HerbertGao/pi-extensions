import net from "node:net"
import { readFile, rm } from "node:fs/promises"
import path from "node:path"
import {
  allocateImageId,
  deleteKittyImage,
  encodeKitty,
  getPngDimensions,
} from "@earendil-works/pi-tui"

const pngPath = process.env.PI_MERMAID_OPEN_PNG
const temporaryDirectory = pngPath ? path.dirname(pngPath) : undefined
const herdrSocketPath = process.env.HERDR_SOCKET_PATH
const herdrPaneId = process.env.HERDR_PANE_ID
const zoomSteps = [1, 1.25, 1.5, 2, 3]
const panStep = 5

let closing = false

function calculateImageCellSize(image, maxWidth, maxHeight, cell) {
  const scale = Math.min(
    (maxWidth * cell.widthPx) / image.widthPx,
    (maxHeight * cell.heightPx) / image.heightPx,
  )
  return {
    columns: Math.ceil((image.widthPx * scale) / cell.widthPx),
    rows: Math.ceil((image.heightPx * scale) / cell.heightPx),
    scale,
  }
}

function encodeKittyFrame(
  base64Data,
  imageId,
  columns,
  rows,
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
) {
  const sequence = encodeKitty(base64Data, {
    columns,
    rows,
    imageId,
    moveCursor: false,
  })
  return sequence.replace(
    "\x1b_G",
    `\x1b_Gx=${sourceX},y=${sourceY},w=${sourceWidth},h=${sourceHeight},`,
  )
}

function herdrRequest(method, params) {
  if (!herdrSocketPath || !herdrPaneId) {
    return Promise.reject(new Error("Herdr graphics context is missing"))
  }

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(herdrSocketPath)
    let buffer = ""
    let settled = false
    const timeout = setTimeout(
      () => settle(reject, new Error(`Herdr request timed out: ${method}`)),
      1500,
    )
    const settle = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.destroy()
      callback(value)
    }

    socket.setEncoding("utf8")
    socket.once("error", (error) => settle(reject, error))
    socket.on("data", (chunk) => {
      buffer += chunk
      const newline = buffer.indexOf("\n")
      if (newline === -1) return

      let response
      try {
        response = JSON.parse(buffer.slice(0, newline))
      } catch {
        settle(reject, new Error("Invalid Herdr API response"))
        return
      }
      if (response.error) {
        settle(
          reject,
          new Error(
            response.error.message ?? `Herdr request failed: ${method}`,
          ),
        )
      } else {
        settle(resolve, response.result)
      }
    })
    socket.once("connect", () => {
      socket.write(
        JSON.stringify({ id: "pi-mermaid-open", method, params }) + "\n",
      )
    })
  })
}

async function finish(clearGraphics = async () => {}) {
  if (closing) return
  closing = true

  if (process.stdin.isTTY) process.stdin.setRawMode(false)
  process.stdin.pause()
  try {
    await clearGraphics()
  } catch {
    // The Herdr pane may already be gone.
  }
  process.stdout.write("\x1b[2J\x1b[H")

  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }

  process.exit(0)
}

function waitForClose(onKey, clearGraphics) {
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on("data", (data) => {
    const input = data.toString("utf8")
    if (
      input === "\x03" ||
      input === "\x1b" ||
      input === "\r" ||
      input === "\n"
    ) {
      void finish(clearGraphics)
      return
    }

    const key = {
      "\x1b[A": "up",
      "\x1bOA": "up",
      "\x1b[B": "down",
      "\x1bOB": "down",
      "\x1b[C": "right",
      "\x1bOC": "right",
      "\x1b[D": "left",
      "\x1bOD": "left",
      h: "left",
      j: "down",
      k: "up",
      l: "right",
    }[input]
    if (key) void onKey(key)
    else if (input === "+" || input === "=") void onKey("zoom-in")
    else if (input === "-") void onKey("zoom-out")
    else if (input === "0") void onKey("reset")
  })
}

process.once("SIGINT", () => void finish())
process.once("SIGTERM", () => void finish())
process.once("SIGHUP", () => void finish())

if (!pngPath) {
  process.stdout.write("Mermaid image path is missing. Press Enter to close.\n")
  waitForClose(() => {})
} else {
  try {
    const base64Data = (await readFile(pngPath)).toString("base64")
    const dimensions = getPngDimensions(base64Data)
    if (!dimensions) throw new Error("invalid PNG")

    const columns = process.stdout.columns ?? 160
    const rows = process.stdout.rows ?? 80
    const availableWidth = Math.max(1, columns - 2)
    const availableHeight = Math.max(1, rows - 4)
    const graphicsInfo = await herdrRequest("pane.graphics.info", {
      pane_id: herdrPaneId,
    })
    const cellDimensions = {
      widthPx: graphicsInfo.cell_width_px ?? 9,
      heightPx: graphicsInfo.cell_height_px ?? 18,
    }
    const imageId = allocateImageId()
    let zoomIndex = 0
    let panX = 0
    let panY = 0
    let imageColumns = 0
    let imageRows = 0
    let maxPanX = 0
    let maxPanY = 0
    let renderQueue = Promise.resolve()

    const clearGraphics = async () => {
      process.stdout.write(deleteKittyImage(imageId))
    }

    async function renderFrame() {
      const size = calculateImageCellSize(
        dimensions,
        availableWidth * zoomSteps[zoomIndex],
        availableHeight * zoomSteps[zoomIndex],
        cellDimensions,
      )
      imageColumns = size.columns
      imageRows = size.rows
      maxPanX = Math.max(0, imageColumns - availableWidth)
      maxPanY = Math.max(0, imageRows - availableHeight)
      panX = Math.max(-maxPanX, Math.min(0, panX))
      panY = Math.max(-maxPanY, Math.min(0, panY))

      const visibleColumns = Math.min(imageColumns, availableWidth)
      const visibleRows = Math.min(imageRows, availableHeight)
      const sourceX = Math.min(
        dimensions.widthPx - 1,
        Math.floor((-panX * cellDimensions.widthPx) / size.scale),
      )
      const sourceY = Math.min(
        dimensions.heightPx - 1,
        Math.floor((-panY * cellDimensions.heightPx) / size.scale),
      )
      const sourceWidth = Math.min(
        dimensions.widthPx - sourceX,
        Math.ceil((visibleColumns * cellDimensions.widthPx) / size.scale),
      )
      const sourceHeight = Math.min(
        dimensions.heightPx - sourceY,
        Math.ceil((visibleRows * cellDimensions.heightPx) / size.scale),
      )
      const imageTop =
        imageRows <= availableHeight
          ? Math.floor((availableHeight - imageRows) / 2)
          : 0
      const imageLeft =
        imageColumns <= availableWidth
          ? Math.floor((columns - imageColumns) / 2)
          : 0

      const frame = encodeKittyFrame(
        base64Data,
        imageId,
        visibleColumns,
        visibleRows,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
      )
      const hint = `Zoom +/- · Pan hjkl/arrows · Reset 0 · Close Enter/Esc`
      const hintLeft = Math.max(0, Math.floor((columns - hint.length) / 2))
      process.stdout.write(
        `\x1b[2J\x1b[H\x1b[${imageTop + 1};${imageLeft + 1}H${frame}\x1b[${rows - 1};${hintLeft + 1}H${hint}`,
      )
    }

    function scheduleRender() {
      renderQueue = renderQueue.then(renderFrame)
      void renderQueue.catch(() => void finish())
    }

    function pan(deltaX, deltaY) {
      const nextX = Math.max(-maxPanX, Math.min(0, panX + deltaX))
      const nextY = Math.max(-maxPanY, Math.min(0, panY + deltaY))
      if (nextX === panX && nextY === panY) return
      panX = nextX
      panY = nextY
      scheduleRender()
    }

    function handleKey(key) {
      if (key === "up") pan(0, panStep)
      else if (key === "down") pan(0, -panStep)
      else if (key === "left") pan(panStep, 0)
      else if (key === "right") pan(-panStep, 0)
      else if (key === "zoom-in" && zoomIndex < zoomSteps.length - 1) {
        zoomIndex++
        panX = 0
        panY = 0
        scheduleRender()
      } else if (key === "zoom-out" && zoomIndex > 0) {
        zoomIndex--
        panX = 0
        panY = 0
        scheduleRender()
      } else if (key === "reset") {
        zoomIndex = 0
        panX = 0
        panY = 0
        scheduleRender()
      }
    }

    await renderFrame()
    waitForClose(handleKey, clearGraphics)
  } catch (error) {
    process.stdout.write(
      `Could not display Mermaid PNG: ${error instanceof Error ? error.message : String(error)}\nPress Enter to close.\n`,
    )
    waitForClose(() => {})
  }
}
