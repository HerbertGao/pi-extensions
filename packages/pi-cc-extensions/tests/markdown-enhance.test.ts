import { test } from "node:test";
import assert from "node:assert";
import { default as enhance } from "../extensions/renderer/markdown-enhance.ts";

const transformers: Array<(md: string, ctx?: object) => string> = [];
enhance({ registerMarkdownTransformer: (fn) => transformers.push(fn) } as never);
const run = (
	md: string,
	ctx = { messageType: "assistant", isStreaming: false, availableWidth: 100 },
) => transformers.reduce((acc, fn) => fn(acc, ctx), md);

test("mermaid 方言渲染", () => {
	assert.ok(run("```sequenceDiagram\nA->>B: hi\n```").includes("┌"));
	assert.ok(run("```stateDiagram-v2\n[*] --> S\n```").includes("╭"));
	assert.ok(run("```classDiagram\nclass A\n```").includes("┌"));
	assert.ok(run("```mermaid\ngraph LR\nA --> B\n```").includes("┌"));
});

test("四反引号围栏", () => {
	assert.ok(run("````mermaid\ngraph LR\nA --> B\n````").includes("┌"));
});

test("未闭合 fence 保留原文", () => {
	const out = run("```mermaid\ngraph LR\nA --> B");
	assert.ok(out.includes("```mermaid") && out.includes("A --> B"));
});

test("图行硬换行", () => {
	const out = run("```mermaid\ngraph LR\nA --> B\n```");
	const lines = out.split("\n").filter((l) => l.startsWith("`┌") || l.includes("┌────"));
	assert.ok(lines.length >= 1, JSON.stringify(out.slice(0, 80)));
});

test("宽度不足框装", () => {
	const out = run("```erdiagram\nCUSTOMER ||--o{ ORDER : places\n```", {
		messageType: "assistant",
		isStreaming: false,
		availableWidth: 10,
	});
	assert.ok(out.includes("╭"));
});

test("流式跳过", () => {
	const md = "```mermaid\ngraph LR\nA --> B\n```";
	assert.strictEqual(
		run(md, { messageType: "assistant", isStreaming: true, availableWidth: 100 }),
		md,
	);
});

test("thinking 块不转换（与官方推荐一致）", () => {
	const md = "```mermaid\ngraph LR\nA --> B\n```\n\n> [!NOTE] 提示\n\n看 https://example.com";
	assert.strictEqual(
		run(md, { messageType: "assistant-thinking", isStreaming: false, availableWidth: 100 }),
		md,
	);
});

test("admonition 转换", () => {
	assert.ok(run("> [!WARNING] 磁盘不足\n> 续行\n\n正文").includes("| ⚠️ WARNING | 磁盘不足 续行 |"));
	assert.ok(run("> [!NOTE] 提示").includes("| 💡 NOTE | 提示 |"));
	assert.ok(run("> [!warning] 小心").includes("WARNING"));
	assert.strictEqual(run("> 普通引用").trim(), "> 普通引用");
});

test("admonition 表格后空行", () => {
	const out = run("> [!WARNING] 磁盘不足\n\n正文");
	// 表格后至少有一个空行，防止紧接段落被解析为表格数据行
	assert.ok(out.includes("|---|---|\n\n"), JSON.stringify(out));
});

test("代码块内 admonition 不转换", () => {
	const out = run("```md\n> [!NOTE] 示例\n```\n\n> [!NOTE] 块外");
	assert.ok(out.includes("> [!NOTE] 示例"));
	assert.ok(out.includes("| 💡 NOTE | 块外 |"));
});

test("admonition 内容 | 转义", () => {
	const out = run("> [!NOTE] 参数 a|b 说明");
	assert.ok(out.includes("a\\|b"), JSON.stringify(out));
});

test("嵌套提示框不互相吞并", () => {
	const out = run("> [!NOTE] 甲\n> [!WARNING] 乙");
	assert.ok(out.includes("| 💡 NOTE | 甲 |") && out.includes("| ⚠️ WARNING | 乙 |"));
});

test("裸 URL 转换", () => {
	const out = run("访问 https://example.com/path 看看。");
	assert.ok(out.includes("[https://example.com/path](https://example.com/path)"));
});

test("中文标点截断", () => {
	const out = run("看 https://example.com/a，和 https://b.com/x. 结束");
	assert.ok(out.includes("[https://example.com/a](https://example.com/a)，"));
	assert.ok(out.includes("[https://b.com/x](https://b.com/x)"));
});

test("行内代码与 <url> 不动", () => {
	const out = run("用 `https://code.com/x` 和 <https://auto.com> 和 https://plain.com");
	assert.ok(out.includes("`https://code.com/x`"));
	assert.ok(!out.includes("[https://code.com/x]"));
	assert.ok(out.includes("<https://auto.com>"));
	assert.ok(out.includes("[https://plain.com](https://plain.com)"));
});

test("已有链接/图片保护", () => {
	const out = run("链接 [点我](https://example.com) 图片 ![图](https://img.com/a.png)");
	assert.ok(out.includes("[点我](https://example.com)"));
	assert.ok(out.includes("![图](https://img.com/a.png)"));
});

test("含括号 URL 保留（括号平衡）", () => {
	const out = run("见 https://en.wikipedia.org/wiki/A_(B) 结束");
	assert.ok(
		out.includes("[https://en.wikipedia.org/wiki/A_(B)](https://en.wikipedia.org/wiki/A_(B))"),
		JSON.stringify(out),
	);
});

test("代码块内 URL 与 admonition 不动", () => {
	const out = run(
		[
			"~~~md",
			"> [!NOTE] https://tilde.example",
			"~~~",
			"   ```md",
			"> [!NOTE] https://indented.example",
			"   ```",
			"外链 https://outside.com",
		].join("\n"),
	);
	assert.ok(out.includes("> [!NOTE] https://tilde.example"));
	assert.ok(out.includes("> [!NOTE] https://indented.example"));
	assert.ok(!out.includes("[https://tilde.example]"));
	assert.ok(!out.includes("[https://indented.example]"));
	assert.ok(out.includes("[https://outside.com](https://outside.com)"));
});

test("圈数字转半角括号（Nerd Font 字形缺陷规避）", () => {
	assert.strictEqual(run("方案②引入，共⑩项"), "方案(2)引入，共(10)项");
	assert.ok(run("① ② ⑳").includes("(1) (2) (20)"));
});

test("圈数字转换保留 fenced blocks 与行内 code spans", () => {
	const input = [
		"① prose",
		"```text",
		"② triple fence",
		"```",
		"`③ inline` and ④ prose",
		"~~~text",
		"⑤ tilde fence",
		"~~~",
		"````text",
		"⑥ long fence",
		"````",
	].join("\n");
	const output = run(input);
	assert.ok(output.includes("(1) prose"));
	assert.ok(output.includes("② triple fence"));
	assert.ok(output.includes("`③ inline` and (4) prose"));
	assert.ok(output.includes("⑤ tilde fence"));
	assert.ok(output.includes("⑥ long fence"));
});

test("未闭合 fence 后的圈数字保持原文", () => {
	assert.strictEqual(
		run("⑦ before\n```text\n⑧ inside\n⑨ still fenced"),
		"(7) before\n```text\n⑧ inside\n⑨ still fenced",
	);
});

test("blockquote 内 fenced code 的圈数字保持原文", () => {
	assert.strictEqual(
		run("> ⑪ prose\n> ```text\n> ⑫ fenced\n> ```\n> ⑬ prose"),
		"> (11) prose\n> ```text\n> ⑫ fenced\n> ```\n> (13) prose",
	);
});

test("不同 blockquote depth 的 fence 不会提前闭合", () => {
	assert.strictEqual(
		run("```text\n> ```\n⑭ still fenced\n```\n⑮ prose"),
		"```text\n> ```\n⑭ still fenced\n```\n(15) prose",
	);
});

test("跨行 inline code span 的圈数字保持原文", () => {
	assert.strictEqual(
		run("⑯ prose `⑰ first\n⑱ second` ⑲ prose"),
		"(16) prose `⑰ first\n⑱ second` (19) prose",
	);
	assert.strictEqual(run("`⑳ unmatched"), "`(20) unmatched");
});

test("退出 blockquote container 会隐式结束 fenced block", () => {
	assert.strictEqual(run("> ```text\n> ① fenced\n② prose"), "> ```text\n> ① fenced\n(2) prose");
});

test("未匹配与转义 backtick 不会隐藏后续 prose 或 code span", () => {
	assert.strictEqual(run("` unmatched ``② code`` ③ prose"), "` unmatched ``② code`` (3) prose");
	assert.strictEqual(run("\\`① escaped\\` ② prose"), "\\`(1) escaped\\` (2) prose");
	assert.strictEqual(run("`①\\` ② prose"), "`①\\` (2) prose");
});

test("inline code span 不跨空行段落边界", () => {
	assert.strictEqual(run("`①\n\n②`"), "`(1)\n\n(2)`");
	assert.strictEqual(run("> `③\n>\n> ④`"), "> `(3)\n>\n> (4)`");
});
