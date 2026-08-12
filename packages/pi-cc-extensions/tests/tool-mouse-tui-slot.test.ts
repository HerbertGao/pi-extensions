import assert from "node:assert/strict";
import test from "node:test";
import {
	getToolMouseTui,
	renderScrollButton,
	setScrollButtonVisible,
	setToolMouseTui,
} from "../extensions/renderer/mouse/scroll.ts";

// 回归：jiti 转译下模块级 let 可成为初始值快照；内部与跨模块读取都必须走
// globalThis Symbol getter，否则 resume 后滚动按钮和 transcript 刷新仍读到 null。
test("mouse state consumers read the global TUI slot", () => {
	const renderer = { mode: "fullscreen", isFollowingOutput: false, requestRender() {} };
	const tui = new Proxy({} as typeof renderer, {
		get: (_target, property) => {
			const value = Reflect.get(renderer, property, renderer);
			return typeof value === "function" ? (...args: any[]) => value.apply(renderer, args) : value;
		},
	});
	try {
		// Simulate a different jiti module generation updating the shared slot.
		(globalThis as any)[Symbol.for("pi.ccstyle.tool-mouse-tui")] = tui;
		setScrollButtonVisible(true);
		assert.equal(getToolMouseTui(), tui);
		assert.match(
			renderScrollButton(80, { fg: (_color: string, text: string) => text })[0] ?? "",
			/Back to bottom/,
		);
	} finally {
		setScrollButtonVisible(false);
		setToolMouseTui(null);
	}
	assert.equal(getToolMouseTui(), null);
});
