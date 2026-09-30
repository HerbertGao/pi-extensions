import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { config } from "./config/config.ts";

// shell
import piAliases from "./feature/shell/aliases.ts";
import { installFlushDockedBash } from "./feature/shell/flush-docked-bash.ts";
import customFooter from "./feature/shell/footer.ts";
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
import markdownEnhance from "./renderer/markdown-enhance.ts";
import {
	COMPACT_MODE_PATCH_KEY,
	COMPACT_THINKING_OWNER,
	patchRegistry,
} from "./utils/patch-keys.ts";

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

	// Renderer 必须先注册 lifecycle handler，shutdown 时才能先解开外层 compact
	// patch，thinking 随后才能恢复原生原型；bridge 转发给稍后安装的 controller。
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
	markdownEnhance(pi);
	claudeCodeStyle(pi, undefined, compactThinkingQuery);
	compactThinking = installCompactThinking(pi, getCompactThinkingConfig());

	// features
	if (config.enableContextCommand) context(pi);
	if (config.enableSessionReference) sessionReference(pi);
	if (config.enableSubagentAutocomplete) agentAutocomplete(pi);
	if (config.enableAgentSummary) agentSummary(pi);
}
