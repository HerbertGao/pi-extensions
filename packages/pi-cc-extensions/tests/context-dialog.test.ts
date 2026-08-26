// escCloseHitbox 的契约：
// [esc] 按钮位于弹框标题行（box 第 2 行）右端，5 列宽；
// bounds 为 0-based 的弹框起点（left/top）+ 宽度。
import assert from "node:assert/strict";
import test from "node:test";
import { formatSkillsForPrompt, initTheme } from "@earendil-works/pi-coding-agent";
import {
	escCloseHitbox,
	hasActiveTextPreview,
	showTextPreview,
	capParts,
	collectContextBreakdown,
	resolveUsedTokens,
} from "../extensions/feature/context.ts";

initTheme("dark");

test("escCloseHitbox places the [esc] hitbox at the right end of the title row", () => {
	assert.deepEqual(escCloseHitbox({ left: 8, top: 1, width: 64 }), {
		row: 3,
		startCol: 67,
		endCol: 71,
	});
});

test("escCloseHitbox keeps the hitbox inside a narrow box", () => {
	assert.deepEqual(escCloseHitbox({ left: 1, top: 1, width: 38 }), {
		row: 3,
		startCol: 34,
		endCol: 38,
	});
});

test("escCloseHitbox follows a non-top dialog row", () => {
	assert.deepEqual(escCloseHitbox({ left: 20, top: 6, width: 50 }), {
		row: 8,
		startCol: 65,
		endCol: 69,
	});
});

test("escCloseHitbox hitbox is 5 columns wide and flush to the right content edge", () => {
	const cases: { left: number; top: number; width: number }[] = [
		{ left: 8, top: 1, width: 64 },
		{ left: 1, top: 1, width: 38 },
		{ left: 20, top: 6, width: 50 },
	];
	for (const bounds of cases) {
		const hitbox = escCloseHitbox(bounds);
		assert.equal(hitbox.endCol - hitbox.startCol + 1, 5, "hitbox is exactly 5 columns wide");
		assert.ok(hitbox.startCol > bounds.left, "hitbox starts inside the box");
		assert.ok(hitbox.endCol < bounds.left + bounds.width, "hitbox ends inside the box");
	}
});

test("context usage reconciles provider tokens and caps variable parts", () => {
	assert.equal(resolveUsedTokens({ tokens: 500, percent: 50 }, 600, 1000), 500);
	assert.equal(resolveUsedTokens({ tokens: 10, percent: 50 }, 600, 1000), 500);
	assert.deepEqual(
		capParts(
			[
				{ label: "System prompt", tokens: 50, color: "accent" },
				{ label: "Tools", tokens: 100, color: "success" },
				{ label: "Context", tokens: 100, color: "warning" },
			],
			100,
			1,
		).map((part) => part.tokens),
		[50, 25, 25],
	);
});

test("context breakdown exposes tool results for preview", () => {
	const breakdown = collectContextBreakdown({
		getSystemPrompt: () => "system",
		getSystemPromptOptions: () => ({
			selectedTools: [],
			contextFiles: [{ path: "AGENTS.md", content: "MEMORY_PREVIEW" }],
		}),
		sessionManager: {
			buildContextEntries: () => [
				{
					type: "message",
					message: {
						role: "toolResult",
						toolCallId: "tool-1",
						toolName: "read",
						content: [{ type: "text", text: "TOOL_RESULT_PREVIEW" }],
						isError: false,
						timestamp: Date.now(),
					},
				},
			],
		},
	} as never);
	assert.match(breakdown.toolResults, /TOOL_RESULT_PREVIEW/);
	assert.equal(breakdown.parts.find((part) => part.label === "Memory")?.tokens ?? 0, 0);
	assert.ok(breakdown.parts.some((part) => part.label === "Tool results" && part.tokens > 0));
});

test("context breakdown attributes embedded memory and skills once", () => {
	const memory = "cccc";
	const skills = [{ name: "ok", description: "desc", filePath: "/v" }];
	const skillsText = formatSkillsForPrompt(skills as any).trim();
	const systemPrompt = `base\n<project_instructions>\n${memory}\n</project_instructions>\n${skillsText}`;
	const breakdown = collectContextBreakdown({
		getSystemPrompt: () => systemPrompt,
		getSystemPromptOptions: () => ({
			selectedTools: [],
			contextFiles: [{ path: "AGENTS.md", content: memory }],
			skills,
		}),
		sessionManager: { buildContextEntries: () => [] },
	} as never);

	const systemTokens = breakdown.parts.find((part) => part.label === "System prompt")?.tokens ?? -1;
	const memoryTokens = breakdown.parts.find((part) => part.label === "Memory")?.tokens ?? -1;
	const skillTokens = breakdown.parts.find((part) => part.label === "Skills")?.tokens ?? -1;
	assert.equal(memoryTokens, Math.ceil(memory.length / 4));
	assert.equal(skillTokens, Math.ceil(skillsText.length / 4));
	assert.equal(systemTokens + memoryTokens + skillTokens, Math.ceil(systemPrompt.length / 4));
});

/** showTextPreview 自定义 UI 的最小 harness：捕获 component（挂载后实时可读），theme 可注入，可选挂载回调。 */
function textPreviewHarness(
	theme: any = { fg: (_color: string, text: string) => text, bold: (text: string) => text },
	onMount?: (component: any) => void,
): any {
	let component: any;
	return {
		custom: async (factory: any) =>
			await new Promise<void>((resolve) => {
				component = factory(
					{ terminal: { columns: 80, rows: 24 }, requestRender() {} },
					theme,
					null,
					resolve,
				);
				onMount?.(component);
			}),
		get component() {
			return component;
		},
	};
}

test("showTextPreview highlights and closes from the [esc] mouse hitbox", async () => {
	let escColor = "";
	const ui = textPreviewHarness(
		{
			fg: (color: string, text: string) => {
				if (text === "[esc]") escColor = color;
				return text;
			},
			bold: (text: string) => text,
		},
		(c) => c.render(64),
	);
	const preview = showTextPreview({ ui } as any, "Output", "hello");
	assert.equal(hasActiveTextPreview(), true);
	assert.equal(escColor, "muted");
	// 80×24、64 列居中、margin 2 → [esc] 命中 row=4, col=67..71。
	ui.component.handleInput(`\x1b[<35;67;4M`);
	ui.component.render(64);
	assert.equal(escColor, "text", "[esc] hover switches to text color");
	ui.component.handleInput(`\x1b[<0;67;4M`);
	await preview;
	assert.equal(hasActiveTextPreview(), false);
});

test("showTextPreview scrollbar supports press and drag", async () => {
	const ui = textPreviewHarness();
	const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n");
	const preview = showTextPreview({ ui } as any, "Output", content);
	const initial = ui.component.render(64).join("\n");
	assert.match(initial, /1-13 \/ 100 lines/);
	// scrollbar col=71，body track row=6..18；从顶部 thumb 拖到底部。
	ui.component.handleInput(`\x1b[<0;71;6M`);
	ui.component.handleInput(`\x1b[<32;71;18M`);
	ui.component.handleInput(`\x1b[<0;71;18m`);
	const dragged = ui.component.render(64).join("\n");
	assert.match(dragged, /88-100 \/ 100 lines/);
	ui.component.handleInput("\x1b");
	await preview;
});
