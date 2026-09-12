import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateDiffString } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

import { shouldRenderRichDiff } from "../extensions/renderer/index.ts";
import {
	parseDiff,
	renderEditDiffResult,
	renderWriteDiffResult,
	type DiffLineEntry,
} from "../extensions/renderer/tool/diff/diff-renderer.ts";
import {
	DEFAULT_TOOL_DISPLAY_CONFIG,
	installWriteOverride,
	renderRichToolResult,
	WriteExecutionMetadataStore,
	type ToolDisplayConfig,
} from "../extensions/renderer/tool/diff/index.ts";
import { sanitizeAnsiForThemedOutput } from "../extensions/renderer/tool/diff/ansi-utils.ts";
import { splitWriteContentLines } from "../extensions/renderer/tool/diff/write-display-utils.ts";
import {
	executeWriteWithMetadata,
	MAX_COMPARABLE_WRITE_BYTES,
	MAX_WRITE_METADATA_ENTRIES,
} from "../extensions/renderer/tool/diff/write-execution.ts";

const theme = {
	fg(_color: string, text: string) {
		return text;
	},
	bg(_color: string, text: string) {
		return text;
	},
	bold(text: string) {
		return text;
	},
} as any;

function output(component: any, width = 100): string[] {
	return component.render(width);
}

test("diff helpers preserve line boundaries and strip colon-form backgrounds", () => {
	assert.deepEqual(splitWriteContentLines("first\r\nsecond\rthird\n"), [
		"first",
		"second",
		"third",
	]);
	assert.equal(
		sanitizeAnsiForThemedOutput("\x1b[38:2::1:2:3mfg\x1b[48:2::4:5:6mbg\x1b[0m"),
		"\x1b[38:2::1:2:3mfgbg\x1b[39;22;23;24;25;27;28;29;59m",
	);
	assert.equal(
		sanitizeAnsiForThemedOutput("\x1b[4:3mcurly\x1b[58:2::1:2:3munderline"),
		"\x1b[4:3mcurly\x1b[58:2::1:2:3munderline",
	);
	assert.equal(
		sanitizeAnsiForThemedOutput(
			"\x1b[38:5:123mvalid\x1b[38:5:mmissing\x1b[38:5:256mwide\x1b[38:2::1:2mshort",
		),
		"\x1b[38:5:123mvalidmissingwideshort",
	);
});

test("rich diff routes only successful edit/write results in on mode", () => {
	for (const mode of ["on", "off"] as const) {
		assert.equal(shouldRenderRichDiff(mode, "edit", false), mode === "on");
		assert.equal(shouldRenderRichDiff(mode, "write", false), mode === "on");
		assert.equal(shouldRenderRichDiff(mode, "read", false), false);
		assert.equal(shouldRenderRichDiff(mode, "edit", true), false);
	}
});

test("edit rich diff is width-safe and honors collapsed/expanded limits", () => {
	const diff = ["@@ -1,40 +1,40 @@"];
	for (let index = 1; index <= 40; index++) {
		diff.push(`-${index}|old value ${index}`, `+${index}|new value ${index}`);
	}
	const store = new WriteExecutionMetadataStore();
	const collapsed = renderRichToolResult(
		"edit",
		{ details: { diff: diff.join("\n") }, content: [] },
		{ expanded: false },
		theme,
		{ args: { path: "sample.ts" } },
		store,
	);
	const collapsedLines = output(collapsed, 32);
	assert.ok(collapsedLines.some((line) => line.includes("more")));
	assert.ok(collapsedLines.every((line) => visibleWidth(line) <= 32));

	const expanded = renderRichToolResult(
		"edit",
		{ details: { diff: diff.join("\n") }, content: [] },
		{ expanded: true },
		theme,
		{ args: { path: "sample.ts" } },
		store,
	);
	assert.ok(output(expanded, 32).length > collapsedLines.length);
});

test("write uses its own live collapsed limit and keeps expanded content", () => {
	const content = Array.from({ length: 12 }, (_, index) => `const value${index} = ${index}`).join(
		"\n",
	);
	let display: ToolDisplayConfig = {
		...DEFAULT_TOOL_DISPLAY_CONFIG,
		editDiffCollapsedLines: 80,
		writeDiffCollapsedLines: 0,
	};
	const collapsed = renderWriteDiffResult(
		content,
		{ expanded: false, filePath: "sample.ts", fileExistedBeforeWrite: false },
		() => display,
		theme,
		"",
	);

	const statsOnly = output(collapsed, 80);
	assert.equal(statsOnly.length, 1);
	assert.match(statsOnly[0] ?? "", /created.*click to show more/);

	display = { ...display, writeDiffCollapsedLines: 2 };
	const twoLines = output(collapsed, 80);
	assert.ok(twoLines.length > statsOnly.length);
	display = { ...display, writeDiffCollapsedLines: 3 };
	const threeLines = output(collapsed, 80);
	assert.notDeepEqual(threeLines, twoLines, "write limit must invalidate the render cache");

	display = { ...display, editDiffCollapsedLines: 1 };
	assert.deepEqual(
		output(collapsed, 80),
		threeLines,
		"edit collapsed limit must not change write output",
	);

	display = { ...display, writeDiffCollapsedLines: 0 };
	const expanded = renderWriteDiffResult(
		content,
		{ expanded: true, filePath: "sample.ts", fileExistedBeforeWrite: false },
		() => display,
		theme,
		"",
	);
	assert.ok(output(expanded, 80).some((line) => line.includes("value0")));
});

test("edit/write collapsed diff hints switch from muted to white text on hover", () => {
	let hovered = false;
	const hoverTheme = {
		...theme,
		fg(color: string, text: string) {
			const code = color === "muted" ? "\x1b[90m" : color === "text" ? "\x1b[97m" : "\x1b[37m";
			return `${code}${text}\x1b[39m`;
		},
	};
	const diff = [
		"@@ -1,40 +1,40 @@",
		...Array.from({ length: 40 }, (_, index) => ` ${index + 1}|const value${index} = ${index}`),
		"-41|const oldValue = 1",
		"+41|const oldValue = 2",
	].join("\n");
	const component = renderEditDiffResult(
		{ diff },
		{ expanded: false, filePath: "sample.ts", isHovered: () => hovered },
		{ ...DEFAULT_TOOL_DISPLAY_CONFIG, editDiffCollapsedLines: 2 },
		hoverTheme,
		"",
	);
	const hint = () => output(component).find((line) => line.includes("click to show more")) ?? "";
	assert.match(hint(), /\x1b\[90m/, "resting edit hint uses muted color");
	hovered = true;
	assert.match(hint(), /\x1b\[90m[^\n]*• [^\n]*\x1b\[39m\x1b\[97mclick to show more/);
	assert.doesNotMatch(hint(), /\x1b\[97m[^\n]*•/, "edit separator dot stays muted");

	hovered = false;
	const writeComponent = renderWriteDiffResult(
		Array.from({ length: 40 }, (_, index) => `const value${index} = ${index}`).join("\n"),
		{
			expanded: false,
			filePath: "sample.ts",
			fileExistedBeforeWrite: false,
			isHovered: () => hovered,
		},
		{ ...DEFAULT_TOOL_DISPLAY_CONFIG, editDiffCollapsedLines: 2 },
		hoverTheme,
		"",
	);
	const writeHint = () =>
		output(writeComponent).find((line) => line.includes("click to show more")) ?? "";
	assert.match(writeHint(), /\x1b\[90m/, "resting write hint uses muted color");
	hovered = true;
	assert.match(writeHint(), /\x1b\[90m[^\n]*• [^\n]*\x1b\[39m\x1b\[97mclick to show more/);
	assert.doesNotMatch(writeHint(), /\x1b\[97m[^\n]*•/, "write separator dot stays muted");
});

test("diff indicator mode live-updates on the same component via config getter", () => {
	// Panel changes must repaint existing tool rows without re-running the tool.
	let display: ToolDisplayConfig = {
		...DEFAULT_TOOL_DISPLAY_CONFIG,
		diffViewMode: "unified",
		diffIndicatorMode: "classic",
		editDiffCollapsedLines: 80,
		expandedPreviewMaxLines: 200,
	};
	const component = renderRichToolResult(
		"edit",
		{
			details: { diff: "@@ -1,1 +1,2 @@\n 1|same line\n+2|added line" },
			content: [],
		},
		{ expanded: true },
		theme,
		{ args: { path: "sample.ts" } },
		new WriteExecutionMetadataStore(),
		() => display,
	);
	assert.ok(component, "edit rich diff should render");

	const classicText = output(component, 80).join("\n");
	assert.match(classicText, /\+.*added line/, "classic mode uses +/- content markers");
	assert.doesNotMatch(
		classicText,
		/• \d+ hunks? • \d+ files?/,
		"unified headers omit redundant hunk and file counts",
	);

	display = { ...display, diffIndicatorMode: "bars" };
	const barsText = output(component, 80).join("\n");
	assert.match(barsText, /▌/, "bars mode uses vertical bar markers");
	assert.notEqual(barsText, classicText, "cache must miss when indicator mode changes");

	display = { ...display, diffIndicatorMode: "none" };
	const noneText = output(component, 80).join("\n");
	assert.doesNotMatch(noneText, /▌/);
	// none: no classic + before added content either (still may contain + in header stats).
	const bodyLines = noneText.split("\n").filter((line) => line.includes("added line"));
	assert.ok(bodyLines.length > 0);
	assert.ok(
		bodyLines.every((line) => !/^\s*\+/.test(line.replace(/^\s*\d+\s*/, ""))),
		"none mode should not prefix added body lines with +",
	);
});

test("split diff keeps the panel transparent while highlighting changed rows", () => {
	const panelBackground = "\x1b[48;2;1;2;3m";
	const ansiTheme = {
		...theme,
		getBgAnsi(color: string) {
			return color === "toolSuccessBg" ? panelBackground : undefined;
		},
	} as any;
	const rendered = renderRichToolResult(
		"edit",
		{
			details: { diff: "@@ -1,2 +1,2 @@\n 1|same\n-2|old\n+2|new" },
			content: [],
		},
		{ expanded: true },
		ansiTheme,
		{ args: { path: "sample.ts" } },
		new WriteExecutionMetadataStore(),
	);
	const text = output(rendered, 140).join("\n");
	assert.equal(text.includes(panelBackground), false);
	assert.match(text, /\x1b\[48;2;/);
});

test("final edit/write diff output removes terminal command injection", () => {
	const osc = "\x1b]52;c;OSC_PAYLOAD\x07";
	const dcs = "\x1bP1;2|DCS_PAYLOAD\x9c";
	const csi = "\x1b[2J";
	const edit = renderEditDiffResult(
		{
			diff: [
				`diff --git a/safe.ts b/safe${osc}.ts`,
				`--- a/safe.ts${dcs}`,
				"+++ b/safe.ts",
				`@@ -1 +1 @@${osc}`,
				`meta${dcs}`,
				`+1|const safe = 1;${csi}`,
			].join("\n"),
		},
		{ expanded: true, filePath: "safe.ts" },
		DEFAULT_TOOL_DISPLAY_CONFIG,
		theme,
		"",
	);
	const write = renderWriteDiffResult(
		`const safe = 1;${osc}${dcs}${csi}`,
		{ expanded: true, filePath: "safe.ts" },
		DEFAULT_TOOL_DISPLAY_CONFIG,
		theme,
		"",
	);
	const editFallback = renderEditDiffResult(
		{},
		{ expanded: true },
		DEFAULT_TOOL_DISPLAY_CONFIG,
		theme,
		`fallback${osc}${dcs}${csi}`,
	);
	const writeFallback = renderWriteDiffResult(
		undefined,
		{ expanded: true },
		DEFAULT_TOOL_DISPLAY_CONFIG,
		theme,
		`fallback${osc}${dcs}${csi}`,
	);

	for (const rendered of [edit, write, editFallback, writeFallback]) {
		const text = output(rendered).join("\n");
		assert.doesNotMatch(text, /OSC_PAYLOAD|DCS_PAYLOAD|\x1b\[2J|\x1b\]|\x1bP|[\x90\x9c\x9d]/);
	}
});

test("write create and overwrite render distinct rich diffs", () => {
	const store = new WriteExecutionMetadataStore();
	store.set("create", { fileExistedBeforeWrite: false });
	store.set("overwrite", { fileExistedBeforeWrite: true, previousContent: "old\n" });
	const create = renderRichToolResult(
		"write",
		{ content: [{ type: "text", text: "ok" }] },
		{ expanded: false },
		theme,
		{ toolCallId: "create", args: { path: "new.ts", content: "new\n" } },
		store,
	);
	const overwrite = renderRichToolResult(
		"write",
		{ content: [{ type: "text", text: "ok" }] },
		{ expanded: false },
		theme,
		{ toolCallId: "overwrite", args: { path: "old.ts", content: "new\n" } },
		store,
	);
	assert.match(output(create).join("\n"), /created/);
	assert.match(output(create).join("\n"), /more/);
	assert.doesNotMatch(
		output(create).join("\n"),
		/\n[^\n]*new[^\n]*$/,
		"collapsed create has no body",
	);
	const overwriteCollapsed = output(overwrite).join("\n");
	assert.match(overwriteCollapsed, /overwritten/);
	assert.match(overwriteCollapsed, /more/);
	assert.doesNotMatch(overwriteCollapsed, /\bold\b/, "collapsed overwrite has no body");

	const overwriteExpanded = renderRichToolResult(
		"write",
		{ content: [{ type: "text", text: "ok" }] },
		{ expanded: true },
		theme,
		{ toolCallId: "overwrite", args: { path: "old.ts", content: "new\n" } },
		store,
	);
	const overwriteText = output(overwriteExpanded).join("\n");
	assert.match(overwriteText, /overwritten/);
	assert.match(overwriteText, /old/);
	assert.match(overwriteText, /new/);
});

test("missing and unavailable write metadata never masquerade as create", () => {
	const store = new WriteExecutionMetadataStore();
	store.set("large", {
		fileExistedBeforeWrite: true,
		diffUnavailableReason: `previous file exceeds ${MAX_COMPARABLE_WRITE_BYTES} bytes`,
	});
	for (const toolCallId of ["missing", "large"]) {
		const rendered = renderRichToolResult(
			"write",
			{ content: [{ type: "text", text: "ok" }] },
			{},
			theme,
			{ toolCallId, args: { path: "file.ts", content: "new" } },
			store,
		);
		assert.match(output(rendered, 28).join("\n"), /diff unavailable/);
		assert.ok(output(rendered, 28).every((line) => visibleWidth(line) <= 28));
	}
});

test("write execution captures the 512000-byte boundary and degrades above it", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ccstyle-diff-"));
	const path = join(directory, "target.txt");
	const store = new WriteExecutionMetadataStore();
	try {
		await writeFile(path, "a".repeat(MAX_COMPARABLE_WRITE_BYTES));
		const result = await executeWriteWithMetadata(
			store,
			"boundary",
			{ path, content: "boundary replacement" },
			undefined,
			directory,
		);
		assert.equal(store.get("boundary")?.previousContent?.length, MAX_COMPARABLE_WRITE_BYTES);
		assert.equal(result.details, undefined);

		await writeFile(path, "b".repeat(MAX_COMPARABLE_WRITE_BYTES + 1));
		await executeWriteWithMetadata(
			store,
			"large",
			{ path, content: "large replacement" },
			undefined,
			directory,
		);
		assert.equal(store.get("large")?.fileExistedBeforeWrite, true);
		assert.match(store.get("large")?.diffUnavailableReason ?? "", /exceeds/);
		assert.equal(await readFile(path, "utf8"), "large replacement");
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("a completed write retains metadata when abort arrives after disk mutation", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ccstyle-write-abort-"));
	const path = join(directory, "target.txt");
	const store = new WriteExecutionMetadataStore();
	let abortReads = 0;
	const signal = {
		get aborted() {
			abortReads++;
			return abortReads >= 4;
		},
	} as AbortSignal;
	try {
		await writeFile(path, "before");
		const result = await executeWriteWithMetadata(
			store,
			"completed",
			{ path, content: "你好" },
			signal,
			directory,
		);
		assert.equal(await readFile(path, "utf8"), "你好");
		assert.equal(store.get("completed")?.previousContent, "before");
		assert.match(result.content[0]?.text ?? "", /6 bytes/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("write metadata is bounded, clearable, and failures do not retain entries", async () => {
	const store = new WriteExecutionMetadataStore();
	for (let index = 0; index <= MAX_WRITE_METADATA_ENTRIES; index++) {
		store.set(String(index), { fileExistedBeforeWrite: false });
	}
	assert.equal(store.entries.size, MAX_WRITE_METADATA_ENTRIES);
	assert.equal(store.get("0"), undefined);
	store.clear();
	assert.equal(store.entries.size, 0);

	const controller = new AbortController();
	controller.abort();
	await assert.rejects(
		executeWriteWithMetadata(
			store,
			"failed",
			{ path: join(tmpdir(), "never-written.txt"), content: "x" },
			controller.signal,
			tmpdir(),
		),
		/aborted/,
	);
	assert.equal(store.get("failed"), undefined);
});

test("third-party write ownership prevents registration", () => {
	const registered: unknown[] = [];
	installWriteOverride({
		getAllTools() {
			return [{ name: "write", sourceInfo: { source: "extension", path: "other.ts" } }];
		},
		registerTool(tool: unknown) {
			registered.push(tool);
		},
	} as any);
	assert.deepEqual(registered, []);
});

function lineEntries(diff: string): DiffLineEntry[] {
	return parseDiff(diff).entries.filter((entry): entry is DiffLineEntry => entry.kind === "line");
}

function comparableLines(lines: DiffLineEntry[]) {
	return lines.map(({ lineKind, oldLineNumber, newLineNumber, content }) => ({
		lineKind,
		oldLineNumber,
		newLineNumber,
		content,
	}));
}

test("rich diff parses Pi headerless numbered rows without leaking line numbers into content", () => {
	const { diff } = generateDiffString("alpha\nbeta\ngamma\n", "alpha\nBETA\ngamma\n");
	assert.deepEqual(comparableLines(lineEntries(diff)), [
		{ lineKind: "context", oldLineNumber: 1, newLineNumber: 1, content: "alpha" },
		{ lineKind: "remove", oldLineNumber: 2, newLineNumber: null, content: "beta" },
		{ lineKind: "add", oldLineNumber: null, newLineNumber: 2, content: "BETA" },
		{ lineKind: "context", oldLineNumber: 3, newLineNumber: 3, content: "gamma" },
	]);
});

test("unified hunks keep numeric source content instead of treating it as a gutter", () => {
	const diff = "@@ -1,2 +1,2 @@\n-100 apples\n+200 apples\n 300 pears";
	assert.deepEqual(comparableLines(lineEntries(diff)), [
		{ lineKind: "remove", oldLineNumber: 1, newLineNumber: null, content: "100 apples" },
		{ lineKind: "add", oldLineNumber: null, newLineNumber: 1, content: "200 apples" },
		{ lineKind: "context", oldLineNumber: 2, newLineNumber: 2, content: "300 pears" },
	]);
});

test("unified patches preserve indented numeric content across hunks and files", () => {
	const diff = [
		"diff --git a/counts.txt b/counts.txt",
		"--- a/counts.txt",
		"+++ b/counts.txt",
		"@@ -40,3 +60,4 @@",
		" 123 count",
		"-  456 units",
		"+  789 units",
		"+  321 units",
		" \t987 value",
		"@@ -80 +101 @@",
		"-5 more",
		"+6 more",
		"diff --git a/other.txt b/other.txt",
		"--- a/other.txt",
		"+++ b/other.txt",
		"@@ -1 +1 @@",
		"-7 old",
		"+8 new",
	].join("\n");
	assert.deepEqual(
		lineEntries(diff).map(({ lineKind, oldLineNumber, newLineNumber, content }) => [
			lineKind,
			oldLineNumber,
			newLineNumber,
			content,
		]),
		[
			["context", 40, 60, "123 count"],
			["remove", 41, null, "  456 units"],
			["add", null, 61, "  789 units"],
			["add", null, 62, "  321 units"],
			["context", 42, 63, "\t987 value"],
			["remove", 80, null, "5 more"],
			["add", null, 101, "6 more"],
			["remove", 1, null, "7 old"],
			["add", null, 1, "8 new"],
		],
	);
});

for (const [lineCount, omission] of [
	[9, "   ..."],
	[30, "    ..."],
	[100, "     ..."],
] as const) {
	test(`Pi omission markers are metadata with ${lineCount}-line number padding`, () => {
		const before = Array.from({ length: lineCount }, (_, index) => `line-${index + 1}`);
		const after = before.map((line, index) => (index === 1 ? "line-2 changed" : line));
		const { diff } = generateDiffString(before.join("\n"), after.join("\n"));
		const parsed = parseDiff(diff);

		assert.deepEqual(parsed.entries.at(-1), { kind: "meta", raw: omission, hunkIndex: 1 });
		assert.equal(parsed.stats.context, 5, "omitted context is not an actual source row");
	});
}

test("Pi leading, intermediate, and trailing omissions stay out of source counts", () => {
	const before = Array.from({ length: 40 }, (_, index) => `line-${index + 1}`);
	const after = before.map((line, index) =>
		index === 10 || index === 29 ? `${line} changed` : line,
	);
	const { diff } = generateDiffString(before.join("\n"), after.join("\n"));
	const parsed = parseDiff(diff);
	const omissions = parsed.entries.filter((entry) => entry.kind === "meta");

	assert.deepEqual(
		omissions.map((entry) => entry.raw),
		["    ...", "    ...", "    ..."],
	);
	assert.equal(parsed.entries[0], omissions[0]);
	assert.equal(parsed.entries.at(-1), omissions[2]);
	assert.deepEqual(parsed.stats, {
		added: 2,
		removed: 2,
		context: 16,
		hunks: 1,
		files: 1,
		lines: 23,
	});
	assert.deepEqual(
		lineEntries(diff)
			.filter((line) => line.lineKind === "context")
			.map(({ oldLineNumber, newLineNumber }) => [oldLineNumber, newLineNumber]),
		[
			[7, 7],
			[8, 8],
			[9, 9],
			[10, 10],
			[12, 12],
			[13, 13],
			[14, 14],
			[15, 15],
			[26, 26],
			[27, 27],
			[28, 28],
			[29, 29],
			[31, 31],
			[32, 32],
			[33, 33],
			[34, 34],
		],
	);
});

for (const format of ["pi", "unified"] as const) {
	test(`${format} literal ellipsis source rows retain their numbers and indentation`, () => {
		const before = "before\n...\n   ...\nafter";
		const after = "BEFORE\n...\n   ...\nafter";
		const diff =
			format === "pi"
				? generateDiffString(before, after).diff
				: "@@ -1,4 +1,4 @@\n-before\n+BEFORE\n ...\n    ...\n after";
		const parsed = parseDiff(diff);

		assert.equal(parsed.stats.context, 3);
		assert.ok(parsed.entries.every((entry) => entry.kind !== "meta"));
		assert.deepEqual(
			lineEntries(diff)
				.filter((line) => line.content.trim() === "...")
				.map(({ oldLineNumber, newLineNumber, content }) => [
					oldLineNumber,
					newLineNumber,
					content,
				]),
			[
				[2, 2, "..."],
				[3, 3, "   ..."],
			],
		);
	});
}
