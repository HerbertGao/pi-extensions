import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

import { initTheme } from "@earendil-works/pi-coding-agent";
import { SettingsList } from "@earendil-works/pi-tui";

const previousDir = process.env.PI_CODING_AGENT_DIR;
const dir = mkdtempSync(join(tmpdir(), "ccstyle-panel-render-readonly-"));
process.env.PI_CODING_AGENT_DIR = dir;
after(() => {
	if (previousDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = previousDir;
	rmSync(dir, { recursive: true, force: true });
});

const { showCcstylePanel } = await import("../extensions/config/panel.ts");
initTheme("dark");

test("panel render copies frozen SettingsList buffers before trimming", async () => {
	const frozenLines = Object.freeze([
		"  Style — preview lines",
		"  > follow",
		"",
		"  Enter/Space to change · Esc to cancel",
		"",
	]);
	const originalRender = SettingsList.prototype.render;
	SettingsList.prototype.render = function renderFrozen() {
		return frozenLines as unknown as string[];
	};

	let panel!: { handleInput(data: string): void; render(width: number): string[] };
	const ctx = {
		mode: "tui",
		hasUI: true,
		ui: {
			notify() {},
			custom(build: Function) {
				return new Promise<void>((resolve) => {
					panel = build(
						{ requestRender() {} },
						{ fg: (_color: string, text: string) => text },
						{},
						resolve,
					);
				});
			},
		},
	};

	try {
		const closed = showCcstylePanel(ctx, {
			applyStyleMode() {},
			refreshCurrentTranscript() {},
		});
		const snapshot = [...frozenLines];
		const output = panel.render(80);
		assert.deepEqual([...frozenLines], snapshot, "frozen list buffer stays untouched");
		assert.equal(frozenLines.length, 5, "source cache length is unchanged");
		assert.match(
			String(frozenLines[3]),
			/Enter\/Space to change/,
			"source hint row is still present",
		);
		assert.ok(output.length > 0, "panel still composes a frame");
		assert.match(
			output.join("\n"),
			/Style — preview lines/,
			"panel still reads list rows from the copy",
		);
		panel.handleInput("\x1b");
		await closed;
	} finally {
		SettingsList.prototype.render = originalRender;
	}
});
