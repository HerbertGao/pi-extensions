import assert from "node:assert/strict";
import test from "node:test";

import {
	agentBadge,
	initAgentBadges,
	renderAgentBadge,
	resolveAgentColor,
} from "../extensions/renderer/tool/agent-badge.ts";
import { renderToolSummary, toolCallSummary } from "../extensions/renderer/tool/names.ts";

const theme = {
	fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
	bold: (text: string) => `*${text}*`,
	getColorMode: () => "truecolor" as const,
};

/** An event bus that answers list-agents like pi-subagents would. */
function badgeBus(
	agents: Array<Record<string, unknown>>,
	log: Array<{ event: string; data: unknown }> = [],
) {
	const handlers = new Map<string, (data: unknown) => void>();
	return {
		log,
		on(event: string, handler: (data: unknown) => void) {
			handlers.set(event, handler);
			return () => handlers.delete(event);
		},
		emit(event: string, data: any) {
			log.push({ event, data });
			if (event === "subagents:rpc:list-agents") {
				handlers.get(`${event}:reply:${data.requestId}`)?.({ success: true, data: { agents } });
			}
			// Lifecycle events pass straight through to subscribers.
			if (event === "subagents:ready" || event === "subagents:agents-changed") {
				handlers.get(event)?.({});
				// A real pi-subagents re-pulls after the change; simulate the pull.
				if (event === "subagents:agents-changed")
					handlers.get("subagents:rpc:list-agents")?.({ requestId: "refetch" });
			}
		},
	};
}

test("color math mirrors pi-subagents: palette names, hex, invalid", () => {
	assert.equal(resolveAgentColor("purple"), "#827DBD");
	assert.equal(resolveAgentColor(" #8b5cf6 "), "#8B5CF6");
	assert.equal(resolveAgentColor("not-a-color"), undefined);
	assert.equal(resolveAgentColor(undefined), undefined);

	const badge = renderAgentBadge("Code Reviewer", "purple", theme);
	assert.ok(badge.includes("\u001b[48;2;130;125;189m"));
	assert.ok(badge.includes(" Code Reviewer "));
	// Light background → black text (same WCAG cut as pi-subagents).
	assert.ok(badge.includes("\u001b[38;2;0;0;0m"));
	// Dark background (navy) → white text.
	assert.ok(renderAgentBadge("Tester", "navy", theme).includes("\u001b[38;2;255;255;255m"));
	// 256-color mode quantizes both layers.
	const ansiTheme = { ...theme, getColorMode: () => "256color" as const };
	const quantized = renderAgentBadge("Reviewer", "#C430C4", ansiTheme);
	assert.ok(quantized.includes("\u001b[48;5;170m"));
	// No color configured → plain name, no ANSI.
	assert.equal(renderAgentBadge("Agent", undefined, theme), "Agent");
});

test("cache fills on ready and refetches on agents-changed", async () => {
	const bus = badgeBus([{ name: "Code Reviewer", displayName: "Code Reviewer", color: "purple" }]);
	const unsub = initAgentBadges(bus);
	try {
		assert.equal(agentBadge("Code Reviewer", theme), undefined); // empty before ready
		bus.emit("subagents:ready", {});
		await new Promise((r) => setTimeout(r, 10));
		const badge = agentBadge("Code Reviewer", theme);
		assert.ok(badge?.includes("\u001b[48;2;130;125;189m"));
		assert.ok(badge?.includes(" Code Reviewer "));
		assert.equal(agentBadge("general-purpose", theme), undefined); // no color
	} finally {
		unsub();
	}
});

test("agent rows badge when the type has a color, stay plain otherwise", () => {
	const bus = badgeBus([{ name: "Reality Checker", color: "red" }]);
	const unsub = initAgentBadges(bus);
	try {
		bus.emit("subagents:ready", {});
		const plain = renderToolSummary(
			toolCallSummary("Agent", { subagent_type: "general-purpose", description: "d" }, {}),
			80,
			theme.fg,
			theme,
		);
		assert.equal(plain, "<toolTitle>Subagent general-purpose</toolTitle><muted> · d</muted>");

		const badged = renderToolSummary(
			toolCallSummary(
				"Agent",
				{ subagent_type: "Reality Checker", description: "Reality check" },
				{},
			),
			80,
			theme.fg,
			theme,
		);
		assert.ok(badged.includes("\u001b[48;2;220;38;38m"));
		assert.ok(badged.includes(" Reality Checker "));
		assert.ok(badged.includes("<muted> · Reality check</muted>"));
		assert.ok(!badged.includes("Subagent Reality Checker"));
	} finally {
		unsub();
	}
});
