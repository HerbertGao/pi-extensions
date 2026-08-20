import { randomBytes, randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import {
  access,
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const aggregateDir = join(root, "packages", "pi-extensions")
const piCli = join(
  root,
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "dist",
  "cli.js",
)
const expectBin = "/usr/bin/expect"
const widths = [80, 120, 192]
const themes = ["cc-dark", "cc-light"]

function assert(condition, message, details) {
  if (condition) return
  const suffix =
    details === undefined ? "" : `\n${JSON.stringify(details, null, 2)}`
  throw new Error(`${message}${suffix}`)
}

function textOf(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) =>
      typeof part === "string"
        ? part
        : typeof part?.text === "string"
          ? part.text
          : "",
    )
    .join("")
}

function runProcess(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: options.detached === true,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk
    })
    const timer = setTimeout(() => {
      if (options.detached && child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL")
        } catch {
          child.kill("SIGKILL")
        }
      } else {
        child.kill("SIGKILL")
      }
      reject(
        new Error(
          `${command} timed out after ${options.timeoutMs ?? 60_000}ms\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      )
    }, options.timeoutMs ?? 60_000)
    child.once("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once("close", (code, signal) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(
          new Error(
            `${command} exited with ${code ?? signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        )
        return
      }
      resolvePromise({ stdout, stderr })
    })
  })
}

function sseChunk(model, delta, finishReason = null, usage) {
  return `data: ${JSON.stringify({
    id: `chatcmpl-pty-${randomBytes(5).toString("hex")}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
    ...(usage ? { usage } : {}),
  })}\n\n`
}

async function startMockProvider(workDir) {
  const requests = []
  const sockets = new Set()
  const model = "smoke-model"
  const server = createServer((request, response) => {
    let raw = ""
    request.setEncoding("utf8")
    request.on("data", (chunk) => {
      raw += chunk
    })
    request.on("end", async () => {
      try {
        const body = JSON.parse(raw)
        const messages = Array.isArray(body.messages) ? body.messages : []
        const systemText = messages
          .filter((message) => message.role === "system")
          .map((message) => textOf(message.content))
          .join("\n")
        const userText = textOf(
          messages.findLast((message) => message.role === "user")?.content,
        )
        const roles = messages.map((message) => message.role)
        const kind = systemText.includes("context summarization assistant")
          ? "compaction"
          : userText.includes("NESTED_REAL_PTY_SMOKE")
            ? "nested-agent"
            : userText.includes("TOOL_ROUND_REAL_PTY_SMOKE") &&
                roles.includes("tool")
              ? "tool-final"
              : userText.includes("TOOL_ROUND_REAL_PTY_SMOKE")
                ? "tool-round"
                : userText.includes("LONG_ONE_REAL_PTY_SMOKE")
                  ? "long-one"
                  : userText.includes("LONG_TWO_REAL_PTY_SMOKE")
                    ? "long-two"
                    : userText.includes("LONG_THREE_REAL_PTY_SMOKE")
                      ? "long-three"
                      : "fallback"
        requests.push({ kind, body })

        response.writeHead(200, {
          "cache-control": "no-cache",
          connection: "close",
          "content-type": "text/event-stream",
        })
        const finish = (reason = "stop") => {
          response.write(
            sseChunk(model, {}, reason, {
              prompt_tokens: 200,
              completion_tokens: 100,
              total_tokens: 300,
            }),
          )
          response.end("data: [DONE]\n\n")
        }
        const content = (value) => {
          response.write(sseChunk(model, { role: "assistant", content: value }))
          finish()
        }

        if (kind === "compaction") {
          content(
            `## Goal\nPreserve real fullscreen PTY smoke evidence.\n\n## Constraints & Preferences\n- Keep packaged ccstyle behavior.\n\n## Progress\n### Done\n- [x] Seeded a long transcript.\n\n### In Progress\n- [ ] Resume matrix.\n\n### Blocked\n- (none)\n\n## Key Decisions\n- **Keep recent tools**: retain the latest tool round.\n\n## Next Steps\n1. Exercise widths and themes.\n\n## Critical Context\n- TOOL_ROUND_REAL_PTY_SMOKE completed.`,
          )
          return
        }
        if (kind === "nested-agent") {
          response.write(
            sseChunk(model, {
              role: "assistant",
              reasoning_content: "Checked the isolated nested smoke task.",
            }),
          )
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 40))
          content("NESTED_AGENT_DEDICATED_RENDERER_OK")
          return
        }
        if (kind === "tool-round") {
          response.write(
            sseChunk(model, {
              role: "assistant",
              reasoning_content:
                "Inspecting the packed tools before the final answer.",
            }),
          )
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 90))
          const calls = [
            ["bash", { command: "printf 'BASH_REAL_PTY_ONE\\n'" }],
            ["read", { path: join(workDir, "read-one.txt"), limit: 5 }],
            ["bash", { command: "printf 'BASH_REAL_PTY_TWO\\n'" }],
            ["read", { path: join(workDir, "read-two.txt"), limit: 5 }],
            [
              "Agent",
              {
                prompt:
                  "NESTED_REAL_PTY_SMOKE: return the deterministic marker only",
                description: "Run nested smoke",
                subagent_type: "general-purpose",
                model: "smoke/smoke-model",
                max_turns: 1,
                run_in_background: false,
                isolated: true,
              },
            ],
          ]
          response.write(
            sseChunk(model, {
              tool_calls: calls.map(([name, args], index) => ({
                index,
                id: `call_real_pty_${index}_${randomBytes(3).toString("hex")}`,
                type: "function",
                function: { name, arguments: JSON.stringify(args) },
              })),
            }),
          )
          finish("tool_calls")
          return
        }
        if (kind === "tool-final") {
          content(
            "① PROSE_MARKER is converted outside code.\n\n```text\n① CODE_MARKER remains circled in fenced code.\n```\n\nTool round complete; Agent dedicated renderer marker retained.",
          )
          return
        }
        if (kind.startsWith("long-")) {
          const ordinal = kind.slice(5)
          content(
            Array.from(
              { length: 75 },
              (_, index) =>
                `Transcript ${ordinal} evidence line ${index + 1}: deterministic fullscreen history padding for manual compaction.`,
            ).join("\n"),
          )
          return
        }
        content("Unexpected smoke request was handled locally.")
      } catch (error) {
        response.writeHead(500, { "content-type": "text/plain" })
        response.end(error instanceof Error ? error.stack : String(error))
      }
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.once("close", () => sockets.delete(socket))
  })
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolvePromise)
  })
  const address = server.address()
  assert(address && typeof address === "object", "Mock provider did not bind")
  return {
    port: address.port,
    requests,
    close: () =>
      new Promise((resolvePromise, reject) => {
        for (const socket of sockets) socket.destroy()
        server.close((error) => (error ? reject(error) : resolvePromise()))
      }),
  }
}

function probeSource(mouseLayoutPath, probeLog, targetPath) {
  return `import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { collapsedHintHitbox } from ${JSON.stringify(mouseLayoutPath)};

const STATE_KEY = Symbol.for("pi.ccstyle.real-pty-smoke-probe");
const host = globalThis;
const state = host[STATE_KEY] ??= {
  generation: 0,
  counters: {
    sgrPackets: 0,
    wheelPackets: 0,
    wheelViewportChanges: 0,
    hoverObserved: 0,
    toolGroupHoverObserved: 0,
    expansionTransitions: 0,
    toolGroupExpansionTransitions: 0,
    viewportChanges: 0,
    backToBottomRendered: 0,
    compactionEvents: 0,
  },
  tui: null,
  ctx: null,
  wrapper: null,
  original: null,
};
state.generation += 1;
const generation = state.generation;
const caseName = process.env.PI_CC_SMOKE_CASE ?? "unknown";
const installGeneration = Number(process.env.PI_CC_SMOKE_INSTALL_GENERATION ?? "0");
const logPath = ${JSON.stringify(probeLog)};
const targetPath = ${JSON.stringify(targetPath)};

function append(event, details = {}) {
  appendFileSync(logPath, JSON.stringify({ event, case: caseName, generation, installGeneration, ...details }) + "\\n");
}
function plain(value) {
  return String(value)
    .replace(/\\x1b\\][^\\x07]*(?:\\x07|\\x1b\\\\)/g, "")
    .replace(/\\x1b\\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\\x1b_[^\\x07]*\\x07/g, "")
    .slice(0, 260);
}
function renderComponentTree(component, width) {
  if (!component || typeof component !== "object") return [];
  try {
    const lines = component.render?.(width);
    if (Array.isArray(lines) && lines.length > 0) return lines;
  } catch {}
  if (!Array.isArray(component.children)) return [];
  return component.children.flatMap((child) => renderComponentTree(child, width));
}
function roots() {
  const result = [];
  try {
    const mounted = state.tui?.getMountedRoots?.();
    if (Array.isArray(mounted)) result.push(...mounted);
  } catch {}
  const layoutComponent = state.tui?.currentLayout?.root?.component;
  if (layoutComponent) result.push(layoutComponent);
  return result;
}
function allComponents() {
  const result = [];
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    result.push(value);
    if (Array.isArray(value.children)) for (const child of value.children) visit(child);
  };
  for (const root of roots()) visit(root);
  return result;
}
function cardStates() {
  const states = new Map();
  for (const component of allComponents()) {
    if (typeof component.setExpanded !== "function") continue;
    const id = component.toolCallId ?? component.lastMessage?.timestamp ?? component.constructor?.name;
    states.set(String(id), Boolean(component.expanded ?? component._expanded));
  }
  return states;
}
function groupStates() {
  const states = new Map();
  for (const component of allComponents()) {
    if (component.toolName !== "Tool group") continue;
    states.set(String(component.toolCallId), Boolean(component.expanded ?? component._expanded));
  }
  return states;
}
function layoutLines() {
  const lines = [];
  const visit = (box) => {
    if (!box) return;
    if (Array.isArray(box.lines)) lines.push(...box.lines.map(plain));
    for (const child of box.children ?? []) visit(child);
  };
  visit(state.tui?.currentLayout?.root);
  return lines;
}
function observeInput(data) {
  const packets = [...String(data).matchAll(/\\x1b\\[<(\\d+);(\\d+);(\\d+)([Mm])/g)].map(
    (match) => ({ code: Number(match[1]), col: Number(match[2]), row: Number(match[3]) }),
  );
  state.counters.sgrPackets += packets.length;
  for (const packet of packets) {
    if ((packet.code & 64) !== 0) state.counters.wheelPackets += 1;
  }
  return packets;
}
function wrapViewport(tui) {
  const original = tui?.handleViewportInput;
  if (typeof original !== "function") return;
  state.original = original;
  const wrapper = function(data) {
    const packets = observeInput(data);
    const beforeCards = cardStates();
    const beforeGroups = groupStates();
    const beforeTop = Number(tui.viewportTop ?? 0);
    const beforeFollowing = Boolean(tui.isFollowingOutput);
    const result = original(data);
    const afterCards = cardStates();
    for (const [id, expanded] of afterCards) {
      if (beforeCards.has(id) && beforeCards.get(id) !== expanded) state.counters.expansionTransitions += 1;
    }
    const afterGroups = groupStates();
    for (const [id, expanded] of afterGroups) {
      if (beforeGroups.has(id) && beforeGroups.get(id) !== expanded) {
        state.counters.toolGroupExpansionTransitions += 1;
      }
    }
    const afterTop = Number(tui.viewportTop ?? 0);
    const afterFollowing = Boolean(tui.isFollowingOutput);
    const viewportChanged = afterTop !== beforeTop || afterFollowing !== beforeFollowing;
    if (viewportChanged) state.counters.viewportChanges += 1;
    if (viewportChanged && packets.some((packet) => (packet.code & 64) !== 0)) {
      state.counters.wheelViewportChanges += 1;
    }
    const groupHovered = allComponents().some((component) => component.hintHovered === true);
    if (
      packets.some((packet) => (packet.code & 32) !== 0) &&
      (host[Symbol.for("pi.ccstyle.tool-hover-state")]?.toolCallId || groupHovered)
    ) {
      state.counters.hoverObserved += 1;
      if (groupHovered) state.counters.toolGroupHoverObserved += 1;
    }
    try { tui.renderNow?.(true); } catch {}
    if (layoutLines().some((line) => line.includes("[ ↓"))) state.counters.backToBottomRendered += 1;
    return result;
  };
  state.wrapper = wrapper;
  tui.handleViewportInput = wrapper;
}
function ownershipSymbols() {
  return Reflect.ownKeys(host)
    .filter((key) => typeof key === "symbol" && String(Symbol.keyFor(key) ?? "").startsWith("pi.ccstyle"))
    .map((key) => {
      const value = host[key];
      return {
        key: Symbol.keyFor(key),
        active: typeof value?.active === "boolean" ? value.active : undefined,
        generation: typeof value?.generation === "number" ? value.generation : undefined,
        ownerType: value?.owner?.constructor?.name ?? value?.constructor?.name ?? typeof value,
      };
    });
}
function configMode() {
  try {
    return JSON.parse(readFileSync(process.env.PI_CODING_AGENT_DIR + "/claude-code-style.json", "utf8")).mode;
  } catch {
    return undefined;
  }
}
function componentSnapshots(width) {
  const hoverId = host[Symbol.for("pi.ccstyle.tool-hover-state")]?.toolCallId ?? null;
  const output = [];
  for (const component of allComponents()) {
    const name = component.constructor?.name ?? "Object";
    const toolLike = typeof component.toolCallId === "string" && typeof component.setExpanded === "function";
    const assistantLike = name.includes("AssistantMessage") || Boolean(component.lastMessage && component.contentContainer);
    const groupLike = name.includes("ToolGroup") || component.toolName === "Tool group";
    if (!toolLike && !assistantLike && !groupLike) continue;
    let lines = [];
    try {
      lines = renderComponentTree(component, width).slice(0, 16).map(plain);
    } catch (error) {
      lines = ["render-capture-failed: " + plain(error?.message ?? error)];
    }
    let renderShell;
    try { renderShell = component.getRenderShell?.(); } catch {}
    const children = Array.isArray(component.children) ? component.children : [];
    const usesContentBox = children.includes(component.contentBox);
    const usesSelfRenderContainer = children.includes(component.selfRenderContainer);
    const dedicatedRenderer =
      component.toolName === "Agent" &&
      component.toolDefinition?.label === "Agent" &&
      typeof component.toolDefinition?.renderCall === "function" &&
      typeof component.toolDefinition?.renderResult === "function" &&
      renderShell === "default" &&
      usesContentBox &&
      !usesSelfRenderContainer;
    output.push({
      type: name,
      toolName: component.toolName,
      toolCallId: component.toolCallId,
      expanded: Boolean(component.expanded ?? component._expanded),
      hovered: component.toolCallId === hoverId || component.hintHovered === true,
      renderShell,
      usesContentBox,
      usesSelfRenderContainer,
      dedicatedRenderer,
      lines,
    });
  }
  return output;
}
function snapshot(label) {
  try { state.tui?.renderNow?.(true); } catch {}
  const columns = Number(state.tui?.terminal?.columns ?? 0);
  const rows = Number(state.tui?.terminal?.rows ?? 0);
  append("snapshot", {
    label,
    terminal: { columns, rows },
    tuiMode: state.tui?.mode,
    theme: state.ctx?.ui?.theme?.name,
    viewportTop: Number(state.tui?.viewportTop ?? 0),
    isFollowingOutput: Boolean(state.tui?.isFollowingOutput),
    ccstyleMode: configMode(),
    symbols: ownershipSymbols(),
    counters: { ...state.counters, reloadGenerations: state.generation },
    layoutLines: layoutLines().slice(0, 80),
    components: componentSnapshots(Math.max(1, columns)),
  });
}
function findTarget() {
  append("target-start");
  try { state.tui?.renderNow?.(true); } catch {}
  const layout = state.tui?.currentLayout;
  const columns = Number(state.tui?.terminal?.columns ?? 0);
  const rows = Number(state.tui?.terminal?.rows ?? 0);
  let target = null;
  let fallback = null;
  const visit = (box) => {
    if (!box || target) return;
    const children = Array.isArray(box.children) ? box.children : [];
    if (children.length > 0) {
      for (const child of children) visit(child);
      return;
    }
    const rect = box.rect;
    const clip = box.clip;
    if (!rect || !clip || !Array.isArray(box.lines)) return;
    const firstRow = Math.max(0, rect.y, clip.y);
    const lastRow = Math.min(rows, rect.y + Math.max(1, rect.height), clip.y + clip.height);
    for (let screenRow = firstRow; screenRow < lastRow; screenRow++) {
      const line = box.lines[screenRow - rect.y];
      if (typeof line !== "string") continue;
      const rendered = plain(line);
      const hint = collapsedHintHitbox(line);
      if (!hint || rendered.includes("Compacted from")) continue;
      const col = Math.max(
        1,
        Math.min(columns, Number(rect.x ?? 0) + Math.floor((hint.startCol + hint.endCol) / 2)),
      );
      const candidate = { col, row: screenRow + 1, line: rendered };
      if (rendered.includes("Multiple Tools")) {
        target = candidate;
        return;
      }
      if (!fallback && /(?:returned|loaded|Thought)/.test(rendered)) fallback = candidate;
    }
  };
  visit(layout?.root);
  target ??= fallback;
  if (target) {
    writeFileSync(targetPath, target.col + " " + target.row + "\\n");
    append("target", target);
    return;
  }
  append("target-miss", { columns, rows, layoutLines: layoutLines() });
}

append("module-load");
export default function(pi) {
  pi.registerCommand("smoke-snapshot", {
    description: "Record a real PTY smoke snapshot or locate a mouse target",
    handler: async (args) => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const label = args.trim() || "unnamed";
      if (label === "target" || label.endsWith(":on")) findTarget();
      snapshot(label);
    },
  });
  pi.on("session_start", async (event, ctx) => {
    state.ctx = ctx;
    ctx.ui.setWidget("real-pty-smoke-probe", (tui) => {
      state.tui = tui;
      wrapViewport(tui);
      return { render: () => [], invalidate() {} };
    });
    append("session_start", { reason: event.reason, mode: state.tui?.mode });
  });
  pi.on("input", async (event) => append("input", { text: String(event.text).slice(0, 80) }));
  pi.on("agent_end", async () => append("agent_end"));
  pi.on("session_before_compact", async (event) => append("session_before_compact", { reason: event.reason }));
  pi.on("session_compact", async (event) => {
    state.counters.compactionEvents += 1;
    append("session_compact", { reason: event.reason });
  });
  pi.on("session_shutdown", async (event, ctx) => {
    append("teardown-start", { reason: event.reason });
    if (state.tui?.handleViewportInput === state.wrapper && state.original) {
      state.tui.handleViewportInput = state.original;
    }
    try { ctx.ui.setWidget("real-pty-smoke-probe", undefined); } catch {}
  });
}
`
}

function tclValue(value) {
  return `[binary format H* ${Buffer.from(String(value)).toString("hex")}]`
}

function expectPrelude({ args, columns, rawLog, probeLog, targetPath }) {
  const argv = args.map((arg) => tclValue(arg)).join(" ")
  return `#!/usr/bin/expect -f
set timeout 90
log_user 0
log_file -noappend ${tclValue(rawLog)}
proc contains {path needle} {
  if {![file exists $path]} { return 0 }
  set handle [open $path r]
  set data [read $handle]
  close $handle
  return [expr {[string first $needle $data] >= 0}]
}
proc drain_spawn {} {
  global timeout
  set previous $timeout
  set timeout 0
  expect {
    -re {.+} { exp_continue }
    timeout {}
    eof {}
  }
  set timeout $previous
}
proc fail {message} {
  catch { close }
  error $message
}
proc wait_contains {path needle seconds} {
  set deadline [expr {[clock milliseconds] + $seconds * 1000}]
  while {[clock milliseconds] < $deadline} {
    drain_spawn
    if {[contains $path $needle]} { return }
    after 100
  }
  fail "timed out waiting for probe marker: $needle"
}
proc wait_count {path needle expected seconds} {
  set deadline [expr {[clock milliseconds] + $seconds * 1000}]
  while {[clock milliseconds] < $deadline} {
    drain_spawn
    set count 0
    if {[file exists $path]} {
      set handle [open $path r]
      set data [read $handle]
      close $handle
      set offset 0
      while {[set index [string first $needle $data $offset]] >= 0} {
        incr count
        set offset [expr {$index + [string length $needle]}]
      }
    }
    if {$count >= $expected} { return }
    after 100
  }
  fail "timed out waiting for probe marker count: $needle x$expected"
}
proc send_line {value} {
  send -- "\\033\\[200~"
  set length [string length $value]
  for {set offset 0} {$offset < $length} {incr offset 400} {
    send -- [string range $value $offset [expr {$offset + 399}]]
    after 2
  }
  send -- "\\033\\[201~"
  after 80
  send -- "\\r"
}
set probe ${tclValue(probeLog)}
set target ${tclValue(targetPath)}
set argv [list ${argv}]
spawn {*}$argv
stty rows 40 cols ${columns} < $spawn_out(slave,name)
send -- "\\033\\[?1;2c"
`
}

function seedExpectScript(options) {
  const longPrompts = [
    `LONG_ONE_REAL_PTY_SMOKE ${"history-one ".repeat(180)}`,
    `LONG_TWO_REAL_PTY_SMOKE ${"history-two ".repeat(180)}`,
    `LONG_THREE_REAL_PTY_SMOKE ${"history-three ".repeat(180)}`,
  ]
  return `${expectPrelude(options)}
wait_contains $probe {"event":"session_start","case":"seed"} 120
after 500
set prompt ${tclValue(longPrompts[0])}
send_line $prompt
wait_count $probe {"event":"agent_end","case":"seed","generation":1,"installGeneration":1} 1 90
set prompt ${tclValue(longPrompts[1])}
send_line $prompt
wait_count $probe {"event":"agent_end","case":"seed","generation":1,"installGeneration":1} 2 90
set prompt ${tclValue(longPrompts[2])}
send_line $prompt
wait_count $probe {"event":"agent_end","case":"seed","generation":1,"installGeneration":1} 3 90
send_line ${tclValue("TOOL_ROUND_REAL_PTY_SMOKE")}
wait_count $probe {"event":"agent_end","case":"seed","generation":1,"installGeneration":1} 4 120
send_line ${tclValue("/smoke-snapshot seed:before-reload")}
wait_contains $probe {"label":"seed:before-reload"} 30
send_line ${tclValue("/reload")}
wait_contains $probe {"event":"session_start","case":"seed","generation":2} 90
send_line ${tclValue("/smoke-snapshot seed:after-reload")}
wait_contains $probe {"label":"seed:after-reload"} 30
send_line ${tclValue("/compact")}
wait_contains $probe {"event":"session_compact","case":"seed"} 90
send_line ${tclValue("/smoke-snapshot seed:after-compact")}
wait_contains $probe {"label":"seed:after-compact"} 30
send_line ${tclValue("/quit")}
expect eof
`
}

function interactionExpectScript(options, label, reload) {
  return `${expectPrelude(options)}
wait_contains $probe {"event":"session_start","case":"${label}"} 120
after 500
send_line ${tclValue("/ccstyle on")}
after 500
send_line ${tclValue(`/smoke-snapshot ${label}:on`)}
wait_contains $probe {"label":"${label}:on"} 30
set deadline [expr {[clock milliseconds] + 30000}]
while {![file exists $target] && [clock milliseconds] < $deadline} { after 100 }
if {![file exists $target]} { fail "smoke target file was not written" }
set handle [open $target r]
set coordinates [string trim [read $handle]]
close $handle
if {![regexp {^(\\d+) (\\d+)$} $coordinates _ col row]} { fail "invalid smoke target: $coordinates" }
send -- "\\033\\[<35;$col;[set row]M"
after 120
send -- "\\033\\[<0;$col;[set row]M"
send -- "\\033\\[<0;$col;[set row]m"
after 180
send_line ${tclValue(`/smoke-snapshot ${label}:expanded`)}
wait_contains $probe {"label":"${label}:expanded"} 30
send -- "\\033\\[<0;$col;[set row]M"
send -- "\\033\\[<0;$col;[set row]m"
after 180
send -- "\\033\\[<64;1;1M"
after 120
send -- "\\033\\[<64;1;1M"
after 120
send -- "\\033\\[<65;1;1M"
after 180
send_line ${tclValue(`/smoke-snapshot ${label}:collapsed`)}
wait_contains $probe {"label":"${label}:collapsed"} 30
send_line ${tclValue("/ccstyle compact")}
send_line ${tclValue(`/smoke-snapshot ${label}:compact`)}
wait_contains $probe {"label":"${label}:compact"} 30
${
  reload
    ? `send_line ${tclValue("/reload")}
wait_contains $probe {"event":"session_start","case":"${label}","generation":2} 90
send_line ${tclValue(`/smoke-snapshot ${label}:reloaded`)}
wait_contains $probe {"label":"${label}:reloaded"} 30`
    : ""
}
send_line ${tclValue("/quit")}
expect eof
`
}

async function writeSettings(agentDir, theme) {
  await writeFile(
    join(agentDir, "settings.json"),
    `${JSON.stringify(
      {
        theme,
        quietStartup: true,
        compaction: {
          enabled: true,
          reserveTokens: 4096,
          keepRecentTokens: 2500,
        },
        retry: { enabled: false },
      },
      null,
      2,
    )}\n`,
  )
}

async function installTarball(tarballPath, installDir, stageDir) {
  await runProcess(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefix",
      installDir,
      tarballPath,
    ],
    { cwd: stageDir, timeoutMs: 180_000 },
  )
}

async function resolvePackedPaths(installDir) {
  const aggregateRoot = join(
    installDir,
    "node_modules",
    "@herbertgao",
    "pi-extensions",
  )
  const ccRoot = join(
    aggregateRoot,
    "node_modules",
    "@herbertgao",
    "pi-cc-extensions",
  )
  const subagentsRoot = join(
    aggregateRoot,
    "node_modules",
    "@herbertgao",
    "pi-subagents",
  )
  const paths = {
    aggregateRoot,
    ccEntry: join(ccRoot, "extensions", "index.ts"),
    mouseLayout: join(ccRoot, "extensions", "renderer", "mouse", "layout.ts"),
    darkTheme: join(ccRoot, "themes", "cc-dark.json"),
    lightTheme: join(ccRoot, "themes", "cc-light.json"),
    subagentsEntry: join(subagentsRoot, "src", "index.ts"),
  }
  await Promise.all(Object.values(paths).map((path) => access(path)))
  return paths
}

function piArgs(paths, probePath, sessionDir, sessionId, seed) {
  return [
    process.execPath,
    piCli,
    "--offline",
    "--no-context-files",
    "--no-skills",
    "--no-extensions",
    "--extension",
    paths.ccEntry,
    "--extension",
    paths.subagentsEntry,
    "--extension",
    probePath,
    "--theme",
    paths.darkTheme,
    "--theme",
    paths.lightTheme,
    "--tui-mode",
    "fullscreen",
    "--provider",
    "smoke",
    "--model",
    "smoke-model",
    "--api-key",
    "smoke-placeholder",
    "--thinking",
    "low",
    "--session-dir",
    sessionDir,
    seed ? "--session-id" : "--session",
    sessionId,
  ]
}

async function runExpectCase({
  stageDir,
  agentDir,
  workDir,
  probeLog,
  targetPath,
  paths,
  probePath,
  sessionDir,
  sessionId,
  caseName,
  theme,
  columns,
  installGeneration,
  seed = false,
  reload = false,
}) {
  await writeSettings(agentDir, theme)
  await rm(targetPath, { force: true })
  const rawLog = join(stageDir, `${caseName}.pty.log`)
  const tuiLog = join(stageDir, `${caseName}.tui.log`)
  const expectOut = join(stageDir, `${caseName}.expect.stdout.log`)
  const expectErr = join(stageDir, `${caseName}.expect.stderr.log`)
  const expectPath = join(stageDir, `${caseName}.expect`)
  const options = {
    args: piArgs(paths, probePath, sessionDir, sessionId, seed),
    columns,
    rawLog,
    probeLog,
    targetPath,
  }
  await writeFile(
    expectPath,
    seed
      ? seedExpectScript(options)
      : interactionExpectScript(options, caseName, reload),
  )
  try {
    const result = await runProcess(expectBin, [expectPath], {
      cwd: workDir,
      env: (() => {
        const env = {
          ...process.env,
          HOME: join(stageDir, "home"),
          PI_CODING_AGENT_DIR: agentDir,
          PI_CC_SMOKE_CASE: caseName,
          PI_CC_SMOKE_INSTALL_GENERATION: String(installGeneration),
          PI_TUI_WRITE_LOG: tuiLog,
          TERM: "xterm-256color",
          NO_COLOR: "",
        }
        delete env.TMUX
        delete env.ZELLIJ
        delete env.STY
        return env
      })(),
      detached: true,
      timeoutMs: seed ? 420_000 : 300_000,
    })
    await Promise.all([
      writeFile(expectOut, result.stdout),
      writeFile(expectErr, result.stderr),
    ])
  } catch (error) {
    await appendFile(
      expectErr,
      `${error instanceof Error ? error.stack : String(error)}\n`,
    )
    throw error
  }
  return {
    caseName,
    rawLog,
    tuiLog,
    expectOut,
    expectErr,
    columns,
    theme,
    installGeneration,
  }
}

function parseProbe(contents) {
  return contents
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`Invalid probe JSONL at line ${index + 1}: ${line}`, {
          cause: error,
        })
      }
    })
}

function snapshotText(snapshot) {
  return [
    ...(snapshot.layoutLines ?? []),
    ...(snapshot.components ?? []).flatMap(
      (component) => component.lines ?? [],
    ),
  ].join("\n")
}

async function validateEvidence(events, runs, mockRequests) {
  const snapshots = events.filter((event) => event.event === "snapshot")
  const byLabel = new Map(
    snapshots.map((snapshot) => [snapshot.label, snapshot]),
  )
  const matrix = []
  for (const theme of themes) {
    for (const width of widths) {
      const name = `${theme}-${width}`
      const on = byLabel.get(`${name}:on`)
      const compact = byLabel.get(`${name}:compact`)
      const expanded = byLabel.get(`${name}:expanded`)
      const collapsed = byLabel.get(`${name}:collapsed`)
      assert(
        on && compact && expanded && collapsed,
        `${name}: incomplete matrix snapshots`,
      )
      for (const snapshot of [on, compact, expanded, collapsed]) {
        assert(
          snapshot.terminal?.columns === width &&
            snapshot.terminal?.rows === 40 &&
            snapshot.tuiMode === "fullscreen",
          `${name}: TUI dimensions/mode mismatch`,
          snapshot.terminal,
        )
        assert(
          snapshot.theme === theme,
          `${name}: active theme mismatch`,
          snapshot.theme,
        )
      }
      assert(on.ccstyleMode === "on", `${name}: on mode was not snapshotted`)
      assert(
        compact.ccstyleMode === "compact",
        `${name}: compact mode was not snapshotted`,
      )
      assert(
        collapsed.counters?.sgrPackets >= 7 &&
          collapsed.counters?.wheelPackets >= 3,
        `${name}: mouse/wheel packets did not reach Pi`,
        collapsed.counters,
      )
      assert(
        collapsed.counters?.wheelViewportChanges > 0,
        `${name}: wheel packets did not causally move the viewport`,
        collapsed.counters,
      )
      assert(
        collapsed.counters?.hoverObserved > 0,
        `${name}: hover was not observed at the real target`,
      )
      assert(
        collapsed.counters?.expansionTransitions >= 2,
        `${name}: click expansion transitions missing`,
        collapsed.counters,
      )
      matrix.push({ theme, width, pass: true })
    }
  }

  const reinstall = byLabel.get("reinstall:collapsed")
  assert(
    reinstall?.installGeneration === 2,
    "Reinstall resume case did not pass",
  )
  assert(
    reinstall.counters?.hoverObserved > 0 &&
      reinstall.counters?.expansionTransitions >= 2,
    "Reinstall interaction evidence missing",
    reinstall?.counters,
  )

  const assertToolRound = (snapshot, label) => {
    const names = (snapshot.components ?? [])
      .filter((component) => typeof component.toolCallId === "string")
      .map((component) => component.toolName)
    assert(
      names.filter((name) => name === "bash").length >= 2 &&
        names.filter((name) => name === "read").length >= 2 &&
        names.includes("Agent"),
      `${label}: expected 2×bash, 2×read, and Agent tool cards`,
      names,
    )
  }

  const requiredStateLabels = [
    "seed:after-reload",
    "seed:after-compact",
    ...themes.flatMap((theme) => widths.map((width) => `${theme}-${width}:on`)),
    "reinstall:on",
  ]
  for (const label of requiredStateLabels) {
    const snapshot = byLabel.get(label)
    assert(snapshot, `Missing state snapshot ${label}`)
    assertToolRound(snapshot, label)
  }

  for (const label of ["seed:after-reload", "seed:after-compact"]) {
    assert(
      /(?:Thought(?: for)?\b|Inspecting the packed tools)/.test(
        snapshotText(byLabel.get(label)),
      ),
      `${label}: completed thinking content missing in on mode`,
    )
  }
  for (const label of [
    ...themes.flatMap((theme) =>
      widths.map((width) => `${theme}-${width}:compact`),
    ),
    "cc-light-120:reloaded",
    "reinstall:compact",
  ]) {
    assert(
      /Ran for (?:\d+ms|\d+s|\d+m(?: \d+s)?)/.test(
        snapshotText(byLabel.get(label)),
      ),
      `${label}: compact elapsed-time label missing`,
    )
  }

  const groupTargets = events.filter(
    (event) =>
      event.event === "target" && event.line?.includes("Multiple Tools"),
  )
  assert(groupTargets.length > 0, "No real ToolGroup target was exercised")
  // v0.8.63 collapses expanded cards only on a double click. Exact double-click
  // timing is pinned by lazy-proxy tests; real PTY evidence stays responsible
  // for the stable browser-independent boundary: hover and one expand transition.
  assert(
    groupTargets.some((target) => {
      const collapsed = byLabel.get(`${target.case}:collapsed`)
      return (
        collapsed?.counters?.toolGroupHoverObserved > 0 &&
        collapsed?.counters?.toolGroupExpansionTransitions >= 1
      )
    }),
    "ToolGroup hover/expand was not causally observed",
  )
  assert(
    snapshots.some((snapshot) =>
      snapshot.components?.some(
        (component) =>
          component.toolName === "Agent" &&
          component.dedicatedRenderer === true &&
          /Run nested smoke/.test((component.lines ?? []).join("\n")) &&
          /isolated.*max turns/.test((component.lines ?? []).join("\n")),
      ),
    ),
    "Agent dedicated renderer evidence missing",
  )
  assert(
    snapshots.some((snapshot) =>
      snapshot.components?.some((component) =>
        component.type?.includes("AssistantMessage"),
      ),
    ),
    "No mounted AssistantMessage-like component was captured",
  )

  assert(
    events.some(
      (event) =>
        event.event === "session_before_compact" && event.reason === "manual",
    ) &&
      events.some(
        (event) =>
          event.event === "session_compact" && event.reason === "manual",
      ),
    "Manual compaction lifecycle did not complete",
  )
  assert(
    events.some(
      (event) => event.event === "teardown-start" && event.reason === "reload",
    ) &&
      events.some(
        (event) => event.event === "session_start" && event.generation >= 2,
      ),
    "Reload teardown/new-generation lifecycle missing",
  )

  const beforeReloadText = snapshotText(byLabel.get("seed:before-reload"))
  const afterReloadText = snapshotText(byLabel.get("seed:after-reload"))
  for (const marker of [
    "Transcript one evidence line 1",
    "Transcript two evidence line 1",
    "Transcript three evidence line 1",
  ]) {
    assert(
      beforeReloadText.includes(marker),
      `seed:before-reload missing ${marker}`,
    )
    assert(
      afterReloadText.includes(marker),
      `seed:after-reload missing ${marker}`,
    )
  }
  assert(
    snapshotText(byLabel.get("seed:after-compact")).includes(
      "Transcript three evidence line 1",
    ),
    "Compaction did not retain the newest long-transcript round",
  )

  const retainedText = snapshots.map(snapshotText).join("\n")
  assert(
    retainedText.includes("(1) PROSE_MARKER") &&
      retainedText.includes("① CODE_MARKER") &&
      !retainedText.includes("① PROSE_MARKER"),
    "Circled-number prose/fenced-code behavior was not preserved",
  )

  const forbidden =
    /(?:render-capture-failed|\bTypeError\b|\bRangeError\b|\bError:|\bexception\b|\buncaught\b|maximum call stack|recursive stack|width[- ]overflow|missing renderer|renderer (?:not found|missing))/i
  const rawPaths = runs.flatMap((run) => [
    run.rawLog,
    run.tuiLog,
    run.expectOut,
    run.expectErr,
  ])
  const rawContents = await Promise.all(
    rawPaths.map(async (path) => ({
      path,
      text: await readFile(path, "utf8"),
    })),
  )
  const badSnapshot = snapshots.find((snapshot) =>
    forbidden.test(JSON.stringify(snapshot)),
  )
  assert(
    !badSnapshot,
    "Forbidden diagnostic found in probe snapshot",
    badSnapshot,
  )
  const badRaw = rawContents.find((entry) => forbidden.test(entry.text))
  assert(!badRaw, `Forbidden diagnostic found in ${badRaw?.path}`)

  const requestKinds = new Set(mockRequests.map((request) => request.kind))
  for (const kind of [
    "long-one",
    "long-two",
    "long-three",
    "tool-round",
    "nested-agent",
    "tool-final",
    "compaction",
  ]) {
    assert(requestKinds.has(kind), `Mock provider did not handle ${kind}`)
  }

  const latestByCase = new Map()
  for (const snapshot of snapshots) latestByCase.set(snapshot.case, snapshot)
  const totals = [...latestByCase.values()].reduce(
    (sum, snapshot) => {
      for (const key of [
        "sgrPackets",
        "wheelPackets",
        "hoverObserved",
        "expansionTransitions",
        "viewportChanges",
        "compactionEvents",
      ]) {
        sum[key] += snapshot.counters?.[key] ?? 0
      }
      return sum
    },
    {
      sgrPackets: 0,
      wheelPackets: 0,
      hoverObserved: 0,
      expansionTransitions: 0,
      viewportChanges: 0,
      compactionEvents: 0,
    },
  )
  return {
    matrix,
    totals,
    snapshots: snapshots.length,
    requests: mockRequests.length,
  }
}

async function main() {
  await Promise.all([access(piCli), access(expectBin), access(aggregateDir)])
  const stageDir = await mkdtemp(join(tmpdir(), "pi-cc-real-pty-smoke-"))
  const probeLog = join(stageDir, "probe.jsonl")
  const targetPath = join(stageDir, "target.txt")
  const probePath = join(stageDir, "probe.ts")
  const agentDir = join(stageDir, "agent")
  const sessionDir = join(stageDir, "sessions")
  const workDir = join(stageDir, "work")
  const homeDir = join(stageDir, "home")
  const runs = []
  let mock
  let succeeded = false
  try {
    await Promise.all(
      [agentDir, sessionDir, workDir, homeDir].map((path) =>
        mkdir(path, { recursive: true }),
      ),
    )
    await Promise.all([
      writeFile(join(workDir, "read-one.txt"), "READ_REAL_PTY_ONE\n"),
      writeFile(join(workDir, "read-two.txt"), "READ_REAL_PTY_TWO\n"),
      writeFile(probeLog, ""),
      writeFile(
        join(agentDir, "claude-code-style.json"),
        `${JSON.stringify(
          {
            mode: "on",
            excludeRenderers: [],
            previewLines: 3,
            showStartupHeader: false,
            scrollStepLines: 3,
          },
          null,
          2,
        )}\n`,
      ),
    ])

    mock = await startMockProvider(workDir)
    await writeFile(
      join(agentDir, "models.json"),
      `${JSON.stringify(
        {
          providers: {
            smoke: {
              baseUrl: `http://127.0.0.1:${mock.port}/v1`,
              api: "openai-completions",
              apiKey: "smoke-placeholder",
              compat: {
                supportsUsageInStreaming: true,
                supportsDeveloperRole: false,
                supportsReasoningEffort: true,
                maxTokensField: "max_tokens",
              },
              models: [
                {
                  id: "smoke-model",
                  name: "Deterministic Reasoning Smoke Model",
                  reasoning: true,
                  input: ["text"],
                  contextWindow: 65536,
                  maxTokens: 4096,
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                },
              ],
            },
          },
        },
        null,
        2,
      )}\n`,
    )

    const packResult = await runProcess(
      "npm",
      ["pack", "--json", "--pack-destination", stageDir, aggregateDir],
      { cwd: root, timeoutMs: 300_000 },
    )
    assert(
      !packResult.stderr.includes("TAR_ENTRY_ERROR"),
      "npm pack reported TAR_ENTRY_ERROR",
      packResult.stderr,
    )
    const packJson = JSON.parse(packResult.stdout)
    assert(
      Array.isArray(packJson) && packJson[0]?.filename,
      "Invalid npm pack --json output",
    )
    const tarballPath = join(stageDir, packJson[0].filename)
    await access(tarballPath)

    const installOne = join(stageDir, "install-1")
    await installTarball(tarballPath, installOne, stageDir)
    let paths = await resolvePackedPaths(installOne)
    await writeFile(
      probePath,
      probeSource(paths.mouseLayout, probeLog, targetPath),
    )

    const sessionId = randomUUID()
    runs.push(
      await runExpectCase({
        stageDir,
        agentDir,
        workDir,
        probeLog,
        targetPath,
        paths,
        probePath,
        sessionDir,
        sessionId,
        caseName: "seed",
        theme: "cc-dark",
        columns: 120,
        installGeneration: 1,
        seed: true,
      }),
    )

    for (const theme of themes) {
      for (const columns of widths) {
        const caseName = `${theme}-${columns}`
        runs.push(
          // Cases share one persisted session and mutable theme settings.
          // oxlint-disable-next-line no-await-in-loop
          await runExpectCase({
            stageDir,
            agentDir,
            workDir,
            probeLog,
            targetPath,
            paths,
            probePath,
            sessionDir,
            sessionId,
            caseName,
            theme,
            columns,
            installGeneration: 1,
            reload: theme === "cc-light" && columns === 120,
          }),
        )
      }
    }

    await rm(installOne, { recursive: true, force: true })
    const installTwo = join(stageDir, "install-2")
    await installTarball(tarballPath, installTwo, stageDir)
    paths = await resolvePackedPaths(installTwo)
    await writeFile(
      probePath,
      probeSource(paths.mouseLayout, probeLog, targetPath),
    )
    runs.push(
      await runExpectCase({
        stageDir,
        agentDir,
        workDir,
        probeLog,
        targetPath,
        paths,
        probePath,
        sessionDir,
        sessionId,
        caseName: "reinstall",
        theme: "cc-dark",
        columns: 120,
        installGeneration: 2,
      }),
    )

    const events = parseProbe(await readFile(probeLog, "utf8"))
    const result = await validateEvidence(events, runs, mock.requests)
    process.stdout.write(`${JSON.stringify({ status: "PASS", ...result })}\n`)
    succeeded = true
  } catch (error) {
    const evidence = {
      stageDir,
      probeLog,
      targetPath,
      runLogs: runs.map((run) => ({
        case: run.caseName,
        raw: run.rawLog,
        tui: run.tuiLog,
        stdout: run.expectOut,
        stderr: run.expectErr,
      })),
    }
    throw new Error(
      `${error instanceof Error ? error.stack : String(error)}\nPreserved failure evidence:\n${JSON.stringify(evidence, null, 2)}`,
      { cause: error },
    )
  } finally {
    if (mock) await mock.close().catch(() => {})
    if (succeeded) await rm(stageDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  )
  process.exitCode = 1
})
