import assert from "node:assert/strict";
import test from "node:test";
import {
	AssistantMessageComponent,
	ToolExecutionComponent,
	initTheme,
} from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { Container, Spacer, visibleWidth } from "@earendil-works/pi-tui";
import { installToolGrouping, ToolGroupComponent } from "../extensions/renderer/tool/grouping.ts";
import { toolViewportWidth } from "../extensions/renderer/tool/result.ts";

initTheme("dark");
const ui = { theme: { fg: (_color: string, text: string) => text }, requestRender() {} } as any;
function tool(name: string, id: string, args: any = {}) {
	return new ToolExecutionComponent(name, id, args, {}, undefined, ui, process.cwd()) as any;
}

test("restored tools keep the static Braille loader", () => {
	const hooks = installToolGrouping(() => true);
	try {
		const parent = new Container() as any;
		parent.addChild(tool("read", "read-stale"));
		parent.addChild(tool("bash", "bash-stale"));
		const group = parent.children[0] as ToolGroupComponent;
		const rendered = group
			.render(100)
			.map((line: string) => line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""))
			.filter((line: string) => line.trim());
		assert.match(rendered[0], /2 running/);
		assert.ok(rendered.some((line: string) => /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(line)));
		assert.doesNotMatch(rendered.join("\n"), /queued/);
		assert.equal((group as any).patch.animationTimer, null);
	} finally {
		hooks.shutdown();
	}
});

test("mixed tools group across three empty separators while edit/write and content break groups", () => {
	let enabled = true;
	const hooks = installToolGrouping(() => enabled);
	try {
		const parent = new Container() as any;
		const read = tool("read", "read");
		const bash = tool("bash", "bash");
		const grep = tool("grep", "grep");
		parent.addChild(read);
		parent.addChild(new Spacer(1));
		parent.addChild(new Spacer(1));
		parent.addChild(new Spacer(1));
		parent.addChild(bash);
		parent.addChild(grep);
		assert.ok(parent.children[0] instanceof ToolGroupComponent);
		const renderedGroup = parent.children[0].render(100);
		assert.notEqual(renderedGroup.at(-1)?.trim(), "", "group does not add a trailing blank row");
		const collapsed = renderedGroup
			.map((line: string) => line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""))
			.filter((line: string) => line.trim());
		assert.match(
			collapsed[0],
			/^ ● Multiple Tools: 3 running .*read, bash, grep.*click to show more/,
		);
		assert.equal(collapsed.filter((line: string) => line.trim()).length, 4);
		assert.match(collapsed[1], /^ ├ [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Read /);
		assert.match(collapsed[2], /^ ├ [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Bash /);
		assert.match(collapsed[3], /^ └ [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Grep /);
		bash.updateResult({ content: [], isError: false });
		grep.updateResult({ content: [], isError: true });
		assert.match(
			parent.children[0].render(100).find((line: string) => line.trim()),
			/1 running.*1 done.*1 failed/,
		);
		const group = parent.children[0] as ToolGroupComponent;
		group.setExpanded(true);
		const expanded = group
			.render(100)
			.map((line: string) => line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""))
			.join("\n");
		assert.doesNotMatch(expanded, /[├└] ● {2}/, "expanded tool titles have one separator");
		group.setExpanded(false);

		parent.addChild(tool("edit", "edit"));
		parent.addChild(tool("read", "after-edit"));
		assert.equal(
			parent.children.filter((child: any) => child instanceof ToolGroupComponent).length,
			1,
		);
		parent.addChild(tool("write", "write"));
		const assistant = new AssistantMessageComponent(
			{
				role: "assistant",
				content: [{ type: "text", text: "boundary" }],
			} as unknown as AssistantMessage,
			true,
		);
		parent.addChild(assistant);
		parent.addChild(tool("bash", "after-content"));
		assert.equal(parent.children.at(-1).toolCallId, "after-content");
	} finally {
		hooks.shutdown();
	}
});

test("tool summaries use the available window width", () => {
	assert.equal(toolViewportWidth(137.9), 137);
	const hooks = installToolGrouping(() => true);
	try {
		const parent = new Container() as any;
		const path =
			"/Users/herbertgao/DongguProjects/shijingshan/ai-risk-platform-contracts/backend/app/modules/risk/services/contract_service.py";
		parent.addChild(tool("read", "long-read", { path, offset: 1, limit: 240 }));
		parent.addChild(tool("bash", "neighbor", { command: "pwd" }));
		const group = parent.children[0] as ToolGroupComponent;
		const wideRead = group
			.render(180)
			.map((line) => line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""))
			.find((line) => line.includes("Read "));
		assert.ok(wideRead?.includes(path), "wide windows keep paths beyond the old 96-char limit");
		assert.match(wideRead, /\(offset=1, limit=240\)$/);

		const narrowRead =
			group
				.render(80)
				.find((line) => line.includes("Read "))
				?.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "") ?? "";
		assert.ok(visibleWidth(narrowRead) <= 80, "narrow windows still clip to their actual width");
		assert.match(narrowRead, /…$/);
	} finally {
		hooks.shutdown();
	}
});

test("expanded native cards align nested trees through interleaved ANSI padding", () => {
	const hooks = installToolGrouping(() => true);
	try {
		const parent = new Container() as any;
		const read = tool("read", "read");
		const bash = tool("bash", "bash");
		parent.addChild(read);
		parent.addChild(bash);
		const group = parent.children[0] as ToolGroupComponent;
		hooks.setTheme({
			fg: (_color: string, text: string) => text,
			bg: (_color: string, text: string) => `\x1b[48;2;10;20;30m${text}\x1b[49m`,
			getBgAnsi: () => "\x1b[48;2;10;20;30m",
		});
		group.setExpanded(true);
		read.render = (width: number) => {
			assert.equal(width, 98, "native card uses the full panel inner width");
			return [
				`\x1b[48;2;20;20;20m  ⠋ Read ${"x".repeat(width - 13)}END \x1b[0m`,
				"\x1b[48;2;20;20;20m \x1b[39m ├ Input\x1b[0m",
				"\x1b[48;2;20;20;20m \x1b[39m │ path: sample.ts\x1b[0m",
				"\x1b[48;2;20;20;20m \x1b[39m └ Output\x1b[0m",
				"\x1b[48;2;20;20;20m \x1b[39m   ok\x1b[0m",
				`  Output ${"x".repeat(width - 13)}END `,
			];
		};
		const rendered = group.render(100);
		const stripAnsi = (line: string) => line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
		const inputLine = rendered.find((line: string) => stripAnsi(line).includes("Input")) ?? "";
		const backgroundIndex = inputLine.indexOf("\x1b[48;");
		assert.equal(backgroundIndex, 0, "expanded panel background covers the full row");
		assert.match(
			stripAnsi(rendered[2]),
			/^ ├ [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Read/,
			"panel starts directly with the loading tool",
		);
		assert.ok(
			rendered.slice(2).every((line) => visibleWidth(line) === 100),
			"expanded content and bottom padding cover exactly the parent width",
		);
		assert.equal(group.childAtRow(2, 100)?.component, read);
		assert.equal(group.childAtRow(7, 100)?.component, read);
		assert.equal(group.childAtRow(8, 100)?.component, bash, "hit testing shares render width");
		const expanded = rendered.map(stripAnsi).join("\n");
		assert.match(
			expanded,
			/^ ├ [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Read x+END  $/m,
			"child status is replaced without clipping its full-width title",
		);
		assert.match(expanded, /^ │ ├ Input\s*$/m, "nested tree aligns with the status dot");
		assert.match(expanded, /^ │ │ path: sample\.ts\s*$/m);
		assert.match(expanded, /^ │   ok\s*$/m, "output content retains its relative indent");
		assert.equal(
			expanded.match(/END {2}$/gm)?.length,
			2,
			"group prefix replacement preserves title and output trailing content",
		);

		const tinyParent = new Container() as any;
		tinyParent.addChild(tool("read", "tiny-read"));
		tinyParent.addChild(tool("bash", "tiny-bash"));
		const tinyGroup = tinyParent.children[0] as ToolGroupComponent;
		tinyGroup.setExpanded(true);
		assert.ok(
			tinyGroup.render(1).every((line) => visibleWidth(line) <= 1),
			"one-column groups never overflow",
		);
	} finally {
		hooks.shutdown();
	}
});

test("external task, skill, and plan tools keep reference summaries in groups", () => {
	const hooks = installToolGrouping(() => true);
	try {
		const parent = new Container() as any;
		parent.addChild(tool("TaskCreate", "task", { subject: "Fix tests" }));
		parent.addChild(tool("Skill", "skill", { name: "deploy" }));
		parent.addChild(tool("EnterPlanMode", "plan"));
		const rendered = parent.children[0].render(160).join("\n");
		assert.match(rendered, /Task Create Fix tests/);
		assert.match(rendered, /Skill deploy/);
		assert.match(rendered, /Enter Plan Mode enable read-only planning/);

		const agentParent = new Container() as any;
		const agent = tool("Agent", "agent", { description: "再次测试 tool 调用" });
		const result = tool("get_subagent_result", "result", {
			agent_id: "6a559462-95d0-40b",
		});
		agent.updateResult({ content: [], isError: false });
		result.updateResult({ content: [], isError: false });
		agentParent.addChild(agent);
		agentParent.addChild(result);
		const agentLines = agentParent.children[0]
			.render(160)
			.map((line: string) => line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""))
			.filter((line: string) => line.trim());
		assert.match(
			agentLines[0],
			/^ ● Multiple Tools: 2 done • Agent, get_subagent_result • click to show more$/,
		);
		assert.equal(agentLines[1], " ├ ✓ Agent 再次测试 tool 调用");
		assert.equal(agentLines[2], " └ ✓ Get Subagent Result 6a559462-95d0-40b");
	} finally {
		hooks.shutdown();
	}
});

test("group status and tool labels use the injected active theme", () => {
	const hooks = installToolGrouping(() => true);
	hooks.setTheme({ fg: (color: string, text: string) => `<${color}>${text}</${color}>` });
	try {
		const parent = new Container() as any;
		const read = tool("read", "themed-read");
		const bash = tool("bash", "themed-bash");
		read.updateResult({ content: [], isError: false });
		bash.updateResult({ content: [], isError: false });
		parent.addChild(read);
		parent.addChild(bash);
		const rendered = parent.children[0].render(200).join("\n");
		assert.match(rendered, /<success>●<\/success>/, "group header stays a status dot");
		assert.match(rendered, /<dim>[├└]<\/dim> <success>✓<\/success>/, "children use checks");
		assert.match(rendered, /<success>2<\/success> done/);
		assert.match(rendered, /<toolTitle>Read /);
		assert.match(rendered, /<toolTitle>Bash /);

		const group = parent.children[0] as ToolGroupComponent;
		group.setHintHovered(true);
		const hovered = group.render(200).join("\n");
		assert.match(
			hovered,
			/<dim>•<\/dim> <text>click to show more<\/text>/,
			"hover highlights text without highlighting the dot",
		);
		assert.doesNotMatch(hovered, /<text>•/);
		group.setExpanded(true);
		const expanded = group.render(200).join("\n");
		assert.equal(expanded.match(/✓/g)?.length, 2, "expanded children keep one check each");
	} finally {
		hooks.shutdown();
	}
});

test("outer removeChild removes grouped tools, dissolves singletons, and clear forgets groups", () => {
	const hooks = installToolGrouping(() => true);
	try {
		const parent = new Container() as any;
		const read = tool("read", "read");
		const bash = tool("bash", "bash");
		const grep = tool("grep", "grep");
		parent.addChild(read);
		parent.addChild(bash);
		parent.addChild(grep);
		const group = parent.children[0] as ToolGroupComponent;
		assert.ok(group instanceof ToolGroupComponent);
		assert.match(
			group.render(100).find((line: string) => line.trim()),
			/click to show more/,
		);

		parent.removeChild(bash);
		assert.deepEqual(group.children, [read, grep]);
		parent.removeChild(read);
		assert.deepEqual(parent.children, [grep], "one remaining tool is automatically ungrouped");
		parent.removeChild(grep);
		assert.deepEqual(parent.children, []);

		parent.addChild(tool("read", "new-read"));
		parent.addChild(tool("bash", "new-bash"));
		assert.ok(parent.children[0] instanceof ToolGroupComponent);
		parent.clear();
		assert.deepEqual(parent.children, []);
		hooks.refresh();
	} finally {
		hooks.shutdown();
	}
});

test("off refresh ungroups, reload rescans existing tools, and stale shutdown preserves ownership", () => {
	const prototype = Container.prototype as any;
	const originalAdd = prototype.addChild;
	let mode: "on" | "off" = "on";
	const first = installToolGrouping(() => mode === "on");
	const parent = new Container() as any;
	parent.addChild(tool("read", "one"));
	parent.addChild(tool("bash", "two"));
	assert.ok(parent.children[0] instanceof ToolGroupComponent);
	mode = "off";
	first.refresh();
	assert.equal(
		parent.children.some((child: any) => child instanceof ToolGroupComponent),
		false,
	);

	mode = "on";
	first.refresh();
	parent.addChild(tool("grep", "three"));
	assert.equal(
		parent.children.some((child: any) => child instanceof ToolGroupComponent),
		false,
	);
	parent.addChild(tool("read", "four"));
	assert.ok(parent.children.at(-1) instanceof ToolGroupComponent);

	const firstWrapper = prototype.addChild;
	const second = installToolGrouping(() => true);
	assert.notEqual(prototype.addChild, firstWrapper);
	assert.equal(
		parent.children.some((child: any) => child instanceof ToolGroupComponent),
		false,
		"replacement install first releases old-module groups",
	);
	second.refresh({ getMountedRoots: () => [parent] });
	assert.ok(parent.children[0] instanceof ToolGroupComponent, "reload regroups mounted transcript");
	assert.equal(parent.children[0].children.length, 4);
	first.shutdown();
	const secondWrapper = prototype.addChild;
	assert.equal(prototype.addChild, secondWrapper, "stale shutdown preserves the new owner");
	second.shutdown();
	assert.equal(prototype.addChild, originalAdd);
});
