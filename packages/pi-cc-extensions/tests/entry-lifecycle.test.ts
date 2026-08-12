import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AssistantMessageComponent, initTheme } from "@earendil-works/pi-coding-agent";

initTheme("dark");

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
	italic: (text: string) => text,
};
const tui = {
	children: [],
	terminal: { columns: 120, rows: 40, write() {} },
	getMountedRoots: () => [],
	requestRender() {},
};
const ctx = {
	mode: "tui",
	hasUI: true,
	sessionManager: {
		getBranch: () => [],
		getEntries: () => [],
		getSessionId: () => "entry-lifecycle",
		getSessionFile: () => undefined,
	},
	ui: {
		theme,
		setHeader() {},
		setStatus() {},
		setWidget(_id: string, factory: any) {
			factory?.(tui, theme);
		},
		requestRender() {},
		getToolsExpanded: () => false,
		addAutocompleteProvider() {},
		notify() {},
	},
} as any;

function runtime() {
	const handlers = new Map<string, Function[]>();
	return {
		pi: {
			on(name: string, handler: Function) {
				const list = handlers.get(name) ?? [];
				list.push(handler);
				handlers.set(name, list);
			},
			registerCommand() {},
			registerTool() {},
			registerEntryRenderer() {},
			registerMarkdownTransformer() {},
			registerMessageRenderer() {},
			appendEntry() {},
			getAllTools: () => [],
			events: { on: () => () => {} },
		} as any,
		async emit(name: string) {
			for (const handler of handlers.get(name) ?? []) await handler({}, ctx);
		},
	};
}

function assertNativePrototype(original: typeof AssistantMessageComponent.prototype.updateContent) {
	assert.equal(AssistantMessageComponent.prototype.updateContent, original);
	assert.equal(
		(AssistantMessageComponent.prototype.updateContent as any)[
			Symbol.for("pi.ccstyle.compact-thinking-update")
		],
		undefined,
	);
}

test("package entry restores the native assistant prototype across reload handoff", async () => {
	const agentDir = mkdtempSync(join(tmpdir(), "pi-cc-entry-lifecycle-"));
	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = agentDir;
	const original = AssistantMessageComponent.prototype.updateContent;
	const runtimes: ReturnType<typeof runtime>[] = [];

	try {
		const { default: extension } = await import("../extensions/index.ts");

		const single = runtime();
		runtimes.push(single);
		extension(single.pi);
		await single.emit("session_start");
		assert.notEqual(AssistantMessageComponent.prototype.updateContent, original);
		await single.emit("session_shutdown");
		assertNativePrototype(original);

		const first = runtime();
		runtimes.push(first);
		extension(first.pi);
		await first.emit("session_start");

		const replacement = runtime();
		runtimes.push(replacement);
		extension(replacement.pi);
		await replacement.emit("session_start");
		await first.emit("session_shutdown");
		await replacement.emit("session_shutdown");
		assertNativePrototype(original);
	} finally {
		for (const current of runtimes.reverse()) {
			await current.emit("session_shutdown").catch(() => {});
		}
		AssistantMessageComponent.prototype.updateContent = original;
		delete (globalThis as any)[Symbol.for("pi.ccstyle.compact-mode-patch")];
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		rmSync(agentDir, { recursive: true, force: true });
	}
});
