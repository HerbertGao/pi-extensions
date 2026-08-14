import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { config } from "./config/config.ts";

// shell
import piAliases from "./feature/shell/aliases.ts";
import piStartupHeader from "./feature/shell/startup-header.ts";
import workingMessage from "./feature/shell/working-message.ts";

// feature
import agentAutocomplete from "./feature/reference/subagent.ts";
import agentSummary from "./feature/agent-summary/index.ts";
import context from "./feature/context.ts";
import sessionReference from "./feature/reference/index.ts";
import {
	installCompactThinking,
	type CompactThinkingController,
} from "./feature/compact-thinking.ts";

// renderer
import claudeCodeStyle, { getCompactThinkingConfig } from "./renderer/index.ts";
import markdownEnhance from "./renderer/markdown-enhance.ts";

export default function (pi: ExtensionAPI): void {
	// shell chrome
	if (config.enableAliases) piAliases(pi);
	piStartupHeader(pi);
	if (config.enableWorkingMessage) workingMessage(pi);

	// Renderer 必须先注册 lifecycle handler，shutdown 时才能先解开外层 compact
	// patch；bridge 让稍后安装的 thinking controller 仍可直接供 renderer query。
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
