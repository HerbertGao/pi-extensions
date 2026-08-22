import { test } from "node:test";
import assert from "node:assert/strict";
import {
	BranchSummaryMessageComponent,
	CompactionSummaryMessageComponent,
	getMarkdownTheme,
	initTheme,
	SkillInvocationMessageComponent,
	type ParsedSkillBlock,
} from "@earendil-works/pi-coding-agent";
import {
	installMessageDisplayRendering,
	refreshMessageDisplays,
	setMessageDisplayTheme,
} from "../extensions/renderer/message-display.ts";
import { config, DEFAULT_CONFIG, setConfig, normalizeConfig } from "../extensions/config/config.ts";

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

initTheme("dark");

function fakeTheme() {
	return { fg: (_color: string, text: string) => text };
}

type CompactionSummaryMessageProps = ConstructorParameters<
	typeof CompactionSummaryMessageComponent
>[0];
type BranchSummaryMessageProps = ConstructorParameters<typeof BranchSummaryMessageComponent>[0];

function makeSkillBlock(name = "ponytail", content = "**lazy** content\n\n- rule 1") {
	return new SkillInvocationMessageComponent(
		{ name, content, userMessage: null } as unknown as ParsedSkillBlock,
		getMarkdownTheme(),
	);
}

function makeCompaction(summary = "summarized history", tokensBefore = 12345) {
	return new CompactionSummaryMessageComponent(
		{ summary, tokensBefore } as unknown as CompactionSummaryMessageProps,
		getMarkdownTheme(),
	);
}

function makeBranch(summary = "branch work") {
	return new BranchSummaryMessageComponent(
		{ summary } as unknown as BranchSummaryMessageProps,
		getMarkdownTheme(),
	);
}

test("message-display: ccstyle on 时三个组件渲染为工具调用风格", () => {
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "on" }));
	const dispose = installMessageDisplayRendering();
	setMessageDisplayTheme(fakeTheme());

	// skill 块：collapsed ● Skill <name>，无原生 [skill] 标签
	const skill = makeSkillBlock();
	const skillCollapsed = stripAnsi(skill.render(120).join("\n"));
	assert.match(skillCollapsed, /✓ Skill ponytail/);
	assert.doesNotMatch(skillCollapsed, /\[skill\]/);
	// 与单 tool 一致：Box paddingY 置 0，折叠行无上下空行
	assert.equal(skill.render(120).length, 1, "折叠行不应有上下空行");
	// expanded：标题行 + markdown 正文，背景与 tool 展开卡相同
	const backgroundSlots: string[] = [];
	setMessageDisplayTheme({
		fg: (_color: string, text: string) => text,
		bg(slot: string, text: string) {
			backgroundSlots.push(slot);
			return text;
		},
	} as any);
	skill.setExpanded(true);
	const skillExpanded = stripAnsi(skill.render(120).join("\n"));
	assert.match(skillExpanded, /✓ Skill ponytail/);
	assert.match(skillExpanded, /lazy/);
	assert.ok(backgroundSlots.includes("userMessageBg"));
	assert.ok(skill.render(120).length > 3, "展开卡应有上下内边距");
	skill.setExpanded(false);
	assert.equal(skill.render(120).length, 1, "收起后恢复单行");
	setMessageDisplayTheme(fakeTheme());

	// 压缩摘要：collapsed ● Compacted from N tokens
	const compaction = makeCompaction();
	const compactionCollapsed = stripAnsi(compaction.render(120).join("\n"));
	assert.match(compactionCollapsed, /✓ Compacted from 12,345 tokens/);
	assert.doesNotMatch(compactionCollapsed, /\[compaction\]/);
	assert.equal(compaction.render(120).length, 1, "折叠行不应有上下空行");
	compaction.setExpanded(true);
	const compactionExpanded = stripAnsi(compaction.render(120).join("\n"));
	assert.match(compactionExpanded, /summarized history/);

	// 分支摘要：collapsed ● Branch summary
	const branch = makeBranch();
	const branchCollapsed = stripAnsi(branch.render(120).join("\n"));
	assert.match(branchCollapsed, /✓ Branch summary/);
	assert.doesNotMatch(branchCollapsed, /\[branch\]/);
	assert.equal(branch.render(120).length, 1, "折叠行不应有上下空行");
	branch.setExpanded(true);
	assert.match(stripAnsi(branch.render(120).join("\n")), /branch work/);

	dispose();
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
});

test("message-display: compact 继续接管三个消息组件", () => {
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "compact" }));
	const dispose = installMessageDisplayRendering();
	setMessageDisplayTheme(fakeTheme());
	const components = [makeSkillBlock(), makeCompaction(), makeBranch()];

	for (const component of components) {
		const rendered = stripAnsi(component.render(120).join("\n"));
		assert.match(rendered, /✓/);
		assert.doesNotMatch(rendered, /\[(?:skill|compaction|branch)\]/);
	}

	dispose();
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
});

test("message-display: mode off 或 dispose 后恢复原生背景与渲染", () => {
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
	const skill = makeSkillBlock() as any;
	const compaction = makeCompaction();
	const nativeBgFn = skill.bgFn;
	assert.equal(typeof nativeBgFn, "function");

	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "on" }));
	const dispose = installMessageDisplayRendering();
	setMessageDisplayTheme({
		fg: (_color: string, text: string) => text,
		bg: (_slot: string, text: string) => `ccstyle:${text}`,
	} as any);
	skill.invalidate();
	compaction.invalidate();
	skill.setExpanded(true);
	assert.notEqual(skill.bgFn, nativeBgFn, "expanded ccstyle replaces the native background");
	assert.doesNotMatch(stripAnsi(skill.render(120).join("\n")), /\[skill\]/);
	assert.doesNotMatch(stripAnsi(compaction.render(120).join("\n")), /\[compaction\]/);

	// mode=off：恢复原生背景、标签与 padding
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
	skill.invalidate();
	compaction.invalidate();
	assert.equal(skill.bgFn, nativeBgFn, "mode off restores the exact native bgFn");
	assert.match(stripAnsi(skill.render(120).join("\n")), /\[skill\]/);
	assert.match(stripAnsi(compaction.render(120).join("\n")), /\[compaction\]/);
	assert.ok(skill.render(120).length > 3, "expanded native render restores padding");

	// 重开后 dispose 无需 invalidate，立即恢复原生背景与 children。
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "on" }));
	skill.invalidate();
	compaction.invalidate();
	assert.notEqual(skill.bgFn, nativeBgFn);
	dispose();
	assert.equal(skill.bgFn, nativeBgFn, "dispose restores the exact native bgFn");
	assert.match(stripAnsi(skill.render(120).join("\n")), /\[skill\]/);
	assert.match(stripAnsi(compaction.render(120).join("\n")), /\[compaction\]/);
});

test("message-display: theme 缺失时新旧组件都回退原生", () => {
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
	const existing = makeSkillBlock() as any;
	const nativeBgFn = existing.bgFn;

	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "on" }));
	const dispose = installMessageDisplayRendering();
	setMessageDisplayTheme(fakeTheme());
	existing.invalidate();
	assert.match(stripAnsi(existing.render(120).join("\n")), /✓ Skill ponytail/);

	setMessageDisplayTheme(undefined);
	existing.invalidate();
	assert.equal(existing.bgFn, nativeBgFn);
	assert.match(stripAnsi(existing.render(120).join("\n")), /\[skill\]/);
	const fresh = makeCompaction();
	assert.match(stripAnsi(fresh.render(120).join("\n")), /\[compaction\]/);

	dispose();
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
});

test("message-display: reinstall 两轮不会把 ccstyle 状态保存为原生", () => {
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
	const skill = makeSkillBlock() as any;
	const nativeBgFn = skill.bgFn;
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "on" }));
	setMessageDisplayTheme({
		fg: (_color: string, text: string) => text,
		bg: (_slot: string, text: string) => `ccstyle:${text}`,
	} as any);

	const disposeFirst = installMessageDisplayRendering();
	skill.setExpanded(true);
	assert.notEqual(skill.bgFn, nativeBgFn);
	const disposeSecond = installMessageDisplayRendering();
	assert.equal(skill.bgFn, nativeBgFn, "reinstall first restores native state");
	assert.match(stripAnsi(skill.render(120).join("\n")), /\[skill\]/);

	skill.invalidate();
	assert.notEqual(skill.bgFn, nativeBgFn);
	const broken = makeBranch() as any;
	const healthy = makeCompaction();
	broken.updateDisplay = () => {
		throw new Error("stale component");
	};
	disposeSecond();
	assert.equal(skill.bgFn, nativeBgFn, "second dispose restores the original native bgFn");
	assert.match(stripAnsi(skill.render(120).join("\n")), /\[skill\]/);
	assert.match(
		stripAnsi(healthy.render(120).join("\n")),
		/\[compaction\]/,
		"one stale component does not block later restores",
	);
	disposeFirst();
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
});

test("message-display: tracking 仅弱引用组件", () => {
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "on" }));
	const dispose = installMessageDisplayRendering();
	setMessageDisplayTheme(fakeTheme());
	const component = makeBranch();
	const patch = (globalThis as any)[Symbol.for("pi.ccstyle.message-display-patch")];
	const refs = [...patch.components];

	assert.ok(refs.length > 0);
	assert.ok(refs.every((ref) => ref instanceof WeakRef));
	assert.equal(patch.components.has(component), false);
	assert.ok(patch.tracked instanceof WeakSet);

	dispose();
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
});

test("message-display: refreshMessageDisplays 遍历并刷新已挂载组件", () => {
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
	const dispose = installMessageDisplayRendering();
	setMessageDisplayTheme(fakeTheme());
	const components = [makeSkillBlock(), makeCompaction(), makeBranch()];
	let invalidated = 0;
	for (const component of components) {
		component.invalidate = () => {
			invalidated++;
			(component as unknown as { updateDisplay(): void }).updateDisplay();
		};
	}
	const root = {
		children: [{ children: components }],
		getMountedRoots: () => [],
	};
	refreshMessageDisplays(root);
	assert.equal(invalidated, 3);
	dispose();
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "on" }));
});
