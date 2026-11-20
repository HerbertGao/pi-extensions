import assert from "node:assert/strict";
import test from "node:test";

import {
	agentBadge,
	clearAgentBadges,
	initAgentBadges,
	NAMED_AGENT_COLORS,
	renderAgentBadge,
	resolveAgentColor,
} from "../extensions/renderer/tool/agent-badge.ts";
import { renderToolSummary, toolCallSummary } from "../extensions/renderer/tool/names.ts";

const theme = {
	fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
	bold: (text: string) => `*${text}*`,
	getColorMode: () => "truecolor" as const,
};

/** An event bus that answers list-agents like pi-subagents would, from a
 * mutable list so a test can change the registry between pulls. */
function badgeBus(holder: { agents: Array<Record<string, unknown>> }) {
	const handlers = new Map<string, (data: unknown) => void>();
	return {
		holder,
		on(event: string, handler: (data: unknown) => void) {
			handlers.set(event, handler);
			return () => handlers.delete(event);
		},
		emit(event: string, data: any) {
			if (event === "subagents:rpc:list-agents") {
				handlers.get(`${event}:reply:${data.requestId}`)?.({
					success: true,
					data: { agents: holder.agents },
				});
			} else {
				handlers.get(event)?.({});
			}
		},
	};
}

test("color math mirrors pi-subagents: palette names, hex, invalid", () => {
	assert.equal(resolveAgentColor("purple"), "#827DBD");
	assert.equal(resolveAgentColor(" #8b5cf6 "), "#8B5CF6");
	assert.equal(resolveAgentColor("not-a-color"), undefined);
	assert.equal(resolveAgentColor(undefined), undefined);

	// fg 与 bg 合并在同一个 SGR、以全量 reset 收尾：stripBackgroundAnsi 只剥
	// 以背景码开头的转义，合并序列在重铺底色的行里原样存活。
	const badge = renderAgentBadge("Code Reviewer", "purple", theme);
	assert.ok(badge.includes("\u001b[38;2;0;0;0;48;2;130;125;189m"));
	assert.ok(badge.includes(" Code Reviewer "));
	assert.ok(badge.endsWith("\u001b[0m"));
	assert.ok(!badge.includes("\u001b[49m"));
	// 深底（navy）配白字。
	assert.ok(
		renderAgentBadge("Tester", "navy", theme).includes("\u001b[38;2;255;255;255;48;2;30;58;138m"),
	);
	// 256 色模式两层都量化。
	const ansiTheme = { ...theme, getColorMode: () => "256color" as const };
	assert.ok(
		renderAgentBadge("Reviewer", "#C430C4", ansiTheme).includes("\u001b[38;5;16;48;5;170m"),
	);
	// 未配置颜色 → 纯名字，无 ANSI。
	assert.equal(renderAgentBadge("Agent", undefined, theme), "Agent");
});

test("cache fills on ready and refetches on agents-changed", async () => {
	const holder = { agents: [{ name: "Code Reviewer", color: "purple" }] };
	const bus = badgeBus(holder);
	const unsub = initAgentBadges(bus);
	try {
		assert.equal(agentBadge("Code Reviewer", theme), undefined); // ready 之前为空
		bus.emit("subagents:ready", {});
		await new Promise((r) => setTimeout(r, 10));
		assert.ok(agentBadge("Code Reviewer", theme)?.includes(" Code Reviewer "));
		assert.equal(agentBadge("general-purpose", theme), undefined); // 无颜色

		// 注册表变化 → 重新拉取：新类型上徽章、旧类型消失。
		holder.agents = [{ name: "MCP Builder", color: "indigo" }];
		bus.emit("subagents:agents-changed", {});
		await new Promise((r) => setTimeout(r, 10));
		assert.ok(agentBadge("MCP Builder", theme)?.includes(" MCP Builder "));
		assert.equal(agentBadge("Code Reviewer", theme), undefined);
	} finally {
		unsub();
	}
});

test("silence, error replies, and invalid colors degrade to plain rows", async () => {
	const holder = { agents: [{ name: "Code Reviewer", color: "purple" }] };
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	// 先填充缓存（后续每个回退场景都从「已上色」出发）。
	const filling = badgeBus(holder);
	const fillUnsub = initAgentBadges(filling);
	filling.emit("subagents:ready", {});
	await sleep(10);
	assert.ok(agentBadge("Code Reviewer", theme));
	fillUnsub();

	// 无应答（无 pi-subagents / 过旧）：超时清缓存，行保持纯文本。
	const silent = {
		handlers: new Map<string, (data: unknown) => void>(),
		on(event: string, handler: (data: unknown) => void) {
			this.handlers.set(event, handler);
			return () => this.handlers.delete(event);
		},
		emit(event: string, _data?: unknown) {
			// 生命周期事件照常派发；list-agents 发出去但永不回应（沉默）。
			this.handlers.get(event)?.({});
		},
	};
	let unsub = initAgentBadges(silent, 20);
	silent.emit("subagents:ready", {});
	await sleep(40);
	assert.equal(agentBadge("Code Reviewer", theme), undefined);
	unsub();

	// 错误回包（success:false）走同一条清空分支。
	const failingBus = {
		handlers: new Map<string, (data: unknown) => void>(),
		on(event: string, handler: (data: unknown) => void) {
			this.handlers.set(event, handler);
			return () => this.handlers.delete(event);
		},
		emit(event: string, data: any) {
			if (event === "subagents:rpc:list-agents") {
				this.handlers.get(`${event}:reply:${data.requestId}`)?.({ success: false });
			} else {
				this.handlers.get(event)?.({});
			}
		},
	};
	const refill = badgeBus(holder);
	const refillUnsub = initAgentBadges(refill);
	refill.emit("subagents:ready", {});
	await sleep(10);
	assert.ok(agentBadge("Code Reviewer", theme));
	refillUnsub();
	unsub = initAgentBadges(failingBus, 2000);
	failingBus.emit("subagents:ready", {});
	await sleep(10);
	assert.equal(agentBadge("Code Reviewer", theme), undefined);
	unsub();

	// 配置了无效颜色的类型：无徽章（与 pi-subagents 的 hasAgentBadge 同规则）。
	const invalidBus = badgeBus({ agents: [{ name: "Odd One", color: "mauve" }] });
	unsub = initAgentBadges(invalidBus);
	invalidBus.emit("subagents:ready", {});
	await sleep(10);
	assert.equal(agentBadge("Odd One", theme), undefined);
	unsub();

	// initAgentBadges 幂等：二次调用替换旧订阅，ready 只触发一次拉取。
	const pulls: string[] = [];
	const countingBus = {
		handlers: new Map<string, (data: unknown) => void>(),
		on(event: string, handler: (data: unknown) => void) {
			this.handlers.set(event, handler);
			return () => this.handlers.delete(event);
		},
		emit(event: string, data: any) {
			if (event === "subagents:rpc:list-agents") {
				pulls.push(data.requestId);
				this.handlers.get(`${event}:reply:${data.requestId}`)?.({
					success: true,
					data: { agents: holder.agents },
				});
			} else {
				this.handlers.get(event)?.({});
			}
		},
	};
	initAgentBadges(countingBus);
	unsub = initAgentBadges(countingBus); // 第二次 init 替换，不叠加
	countingBus.emit("subagents:ready", {});
	await sleep(10);
	assert.equal(pulls.length, 1);
	unsub();

	// 完全没有 bus（无头宿主）：不抛错。
	assert.doesNotThrow(() => initAgentBadges(undefined));
});

test("agent rows badge when the type has a color, stay plain otherwise", () => {
	const holder = { agents: [{ name: "Reality Checker", color: "red" }] };
	const bus = badgeBus(holder);
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
		assert.ok(badged.includes("\u001b[38;2;255;255;255;48;2;220;38;38m"));
		assert.ok(badged.includes(" Reality Checker "));
		assert.ok(badged.includes("<muted> · Reality check</muted>"));
		assert.ok(!badged.includes("Subagent Reality Checker"));
	} finally {
		unsub();
	}
});

test("palette mirrors pi-subagents value for value", () => {
	// 逐项钉死：任何一个色值漂移（曾发生过：neon-cyan 抄错一位）都会在这里失败。
	assert.deepEqual(NAMED_AGENT_COLORS, {
		red: "#DC2626",
		blue: "#6A9BCC",
		green: "#16A34A",
		yellow: "#CA8A04",
		purple: "#827DBD",
		orange: "#D97757",
		pink: "#C46686",
		cyan: "#0891B2",
		amber: "#F59E0B",
		teal: "#008080",
		indigo: "#6366F1",
		gold: "#EAB308",
		"neon-green": "#10B981",
		"neon-cyan": "#06B6D4",
		"metallic-blue": "#3B82F6",
		violet: "#8B5CF6",
		rose: "#F43F5E",
		lime: "#84CC16",
		gray: "#6B7280",
		grey: "#6B7280",
		fuchsia: "#D946EF",
		slate: "#64748B",
		navy: "#1E3A8A",
	});
});

test("badges key on the spawn type, never on a run's own name", () => {
	const holder = { agents: [{ name: "Code Reviewer", color: "purple" }] };
	const bus = badgeBus(holder);
	const unsub = initAgentBadges(bus);
	try {
		bus.emit("subagents:ready", {});
		// general-purpose 运行起名 Code Reviewer：标签显示运行名，但不捡注册类型的徽章。
		const impersonating = renderToolSummary(
			toolCallSummary(
				"Agent",
				{ subagent_type: "general-purpose", name: "Code Reviewer", description: "d" },
				{},
			),
			80,
			theme.fg,
			theme,
		);
		assert.equal(impersonating, "<toolTitle>Subagent Code Reviewer</toolTitle><muted> · d</muted>");
	} finally {
		unsub();
	}
});

test("a malformed reply clears instead of throwing", async () => {
	const holder = { agents: [{ name: "Code Reviewer", color: "purple" }] };
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const refill = badgeBus(holder);
	const refillUnsub = initAgentBadges(refill);
	refill.emit("subagents:ready", {});
	await sleep(10);
	assert.ok(agentBadge("Code Reviewer", theme));
	refillUnsub();

	const garbageBus = {
		handlers: new Map<string, (data: unknown) => void>(),
		on(event: string, handler: (data: unknown) => void) {
			this.handlers.set(event, handler);
			return () => this.handlers.delete(event);
		},
		emit(event: string, data: any) {
			if (event === "subagents:rpc:list-agents") {
				this.handlers.get(`${event}:reply:${data.requestId}`)?.(null);
			} else {
				this.handlers.get(event)?.({});
			}
		},
	};
	const unsub = initAgentBadges(garbageBus, 2000);
	assert.doesNotThrow(() => garbageBus.emit("subagents:ready", {}));
	await sleep(10);
	assert.equal(agentBadge("Code Reviewer", theme), undefined);
	unsub();
});

test("clearAgentBadges drops the table for a fresh session", async () => {
	const holder = { agents: [{ name: "Code Reviewer", color: "purple" }] };
	const bus = badgeBus(holder);
	const unsub = initAgentBadges(bus);
	try {
		bus.emit("subagents:ready", {});
		await new Promise((r) => setTimeout(r, 10));
		assert.ok(agentBadge("Code Reviewer", theme));
		clearAgentBadges();
		assert.equal(agentBadge("Code Reviewer", theme), undefined);
	} finally {
		unsub();
	}
});

test("a superseded pull's timeout never wipes the newer pull's fill", async () => {
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const holder = { agents: [{ name: "Code Reviewer", color: "purple" }] };
	// 复刻 Bugbot 抓到的竞态：第一次拉取（session_start 时 RPC 未挂上）无应答，
	// 第二次拉取（subagents:ready 之后）成功；前者的超时绝不能清掉后者的结果。
	let pulls = 0;
	const racingBus = {
		handlers: new Map<string, (data: unknown) => void>(),
		on(event: string, handler: (data: unknown) => void) {
			this.handlers.set(event, handler);
			return () => this.handlers.delete(event);
		},
		emit(event: string, data: any) {
			if (event === "subagents:rpc:list-agents") {
				pulls++;
				if (pulls > 1) {
					this.handlers.get(`${event}:reply:${data.requestId}`)?.({
						success: true,
						data: { agents: holder.agents },
					});
				} // 第一步：沉默
			} else {
				this.handlers.get(event)?.({});
			}
		},
	};
	const unsub = initAgentBadges(racingBus, 30); // doomed 定时器 30ms
	try {
		racingBus.emit("subagents:ready", {}); // pull 1：无应答（超时挂起）
		await sleep(5);
		racingBus.emit("subagents:agents-changed", {}); // pull 2：成功填充
		await sleep(80); // pull 1 的超时在此期间到点
		assert.ok(
			agentBadge("Code Reviewer", theme) !== undefined,
			"superseded timeout must not wipe the fresh fill",
		);
	} finally {
		unsub();
	}
});
