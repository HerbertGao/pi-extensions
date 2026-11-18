import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { config } from "./config/config.ts";

// shell
import piAliases from "./feature/shell/aliases.ts";
import { installFlushDockedBash } from "./feature/shell/flush-docked-bash.ts";
import customFooter from "./feature/shell/footer.ts";
import { applyPromptEditor } from "./feature/shell/prompt-editor.ts";
import piStartupHeader, { installEarlyStartupHeader } from "./feature/shell/startup-header.ts";
import workingMessage from "./feature/shell/working-message.ts";

// feature
import agentAutocomplete from "./feature/reference/subagent.ts";
import agentSummary from "./feature/agent-summary/index.ts";
import context from "./feature/context.ts";
import sessionReference from "./feature/reference/index.ts";
import {
	type CompactThinkingController,
	installCompactThinking,
} from "./feature/compact-thinking.ts";

// renderer
import claudeCodeStyle, { getCompactThinkingConfig } from "./renderer/index.ts";
import { MARKDOWN_ENHANCE_MESSAGE_TYPES, transformMarkdown } from "./renderer/markdown-enhance.ts";
import tableCopy from "./renderer/table-copy.ts";
import {
	COMPACT_MODE_PATCH_KEY,
	COMPACT_THINKING_OWNER,
	patchRegistry,
} from "./utils/patch-keys.ts";

/**
 * One registration per extension: table provenance must not replace enhancement.
 * Pi 1.5.1 is the first release whose types accept the message-type option.
 * This workspace still typechecks against Pi 1.5.0, so the call is cast.
 * 1.5.1+ hosts honor the option; 1.5.0 ignores it.
 */
export function configureMarkdownRendering(
	pi: ExtensionAPI,
	{
		enableMarkdownEnhance,
		enableTableCopy,
	}: { enableMarkdownEnhance: boolean; enableTableCopy: boolean },
): void {
	const copy = enableTableCopy ? tableCopy(pi) : undefined;
	if (!enableMarkdownEnhance && !copy) return;
	const registerMarkdownTransformer = pi.registerMarkdownTransformer as (
		transformer: Parameters<ExtensionAPI["registerMarkdownTransformer"]>[0],
		options?: { messageTypes?: readonly string[] },
	) => void;
	registerMarkdownTransformer(
		(markdown, context) => {
			copy?.noteSource(context);
			return enableMarkdownEnhance ? transformMarkdown(markdown, context) : markdown;
		},
		{ messageTypes: enableMarkdownEnhance ? MARKDOWN_ENHANCE_MESSAGE_TYPES : ["assistant"] },
	);
}

export default function (pi: ExtensionAPI): void {
	// /reload 或会话切换接手：先释放旧一代 compact 外层，再停旧 thinking
	// owner（顺序不可反，否则新一代会把旧 wrapper 误采样为 native 原型，
	// 补丁因此在 shutdown 后残留或叠加）。
	patchRegistry.get<{ dispose(): void }>(COMPACT_MODE_PATCH_KEY)?.dispose();
	patchRegistry.get<{ stop(): void }>(COMPACT_THINKING_OWNER)?.stop();

	// shell chrome
	if (config.enableAliases) piAliases(pi);
	installFlushDockedBash();
	installEarlyStartupHeader();
	piStartupHeader(pi);
	if (config.enableWorkingMessage) workingMessage(pi);
	customFooter(pi);

	// 输入框 ❯ 提示符：session_start 时按配置应用；setEditorComponent 是一次性替换。
	pi.on("session_start", (_event, ctx) => {
		applyPromptEditor(ctx);
	});

	// Renderer 必须先注册 lifecycle handler，shutdown 时才能先解开外层 compact
	// patch，thinking 随后才能恢复原生原型；bridge 转发给稍后安装的 controller。
	// 两个 markdown 功能独立开关，但共享同一个 transformer 注册槽位。
	let compactThinking: CompactThinkingController | undefined;
	const compactThinkingQuery: CompactThinkingController = {
		updateConfig: (next) => compactThinking?.updateConfig(next),
		getMessageThinkingDurationMs: (timestamp) =>
			compactThinking?.getMessageThinkingDurationMs?.(timestamp),
		isMessageThinkingActive: (timestamp) =>
			compactThinking?.isMessageThinkingActive?.(timestamp) ?? false,
		getThinkingAnimationFrame: () => compactThinking?.getThinkingAnimationFrame?.() ?? 0,
		setCompactSummaryActive: (active) => compactThinking?.setCompactSummaryActive?.(active),
	};
	configureMarkdownRendering(pi, config);
	claudeCodeStyle(pi, undefined, compactThinkingQuery);
	compactThinking = installCompactThinking(pi, getCompactThinkingConfig());

	// features
	if (config.enableContextCommand) context(pi);
	if (config.enableSessionReference) sessionReference(pi);
	if (config.enableSubagentAutocomplete) agentAutocomplete(pi);
	if (config.enableAgentSummary) agentSummary(pi);
}
