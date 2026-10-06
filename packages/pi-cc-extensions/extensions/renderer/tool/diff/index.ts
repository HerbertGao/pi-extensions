import { createWriteToolDefinition, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth } from "@earendil-works/pi-tui";
import { textFromResult } from "../result.ts";
import {
	renderEditDiffResult,
	renderWriteDiffResult,
	type DisplayConfigInput,
} from "./diff-renderer.ts";
import { DEFAULT_TOOL_DISPLAY_CONFIG } from "../../../config/config.ts";
import { patchRegistry, WRITE_OWNERSHIP_SLOT } from "../../../utils/patch-keys.ts";
import {
	capturePreviousContent,
	executeWriteWithMetadata,
	WriteExecutionMetadataStore,
} from "./write-execution.ts";

const WRITE_METADATA_OBSERVER = Symbol.for("herbertgao.pi.writeMetadataObserver");

function resultText(result: any): string {
	const blocks = Array.isArray(result?.content) ? result.content : [];
	return blocks
		.filter((block: any) => block?.type === "text" && typeof block.text === "string")
		.map((block: any) => block.text)
		.join("\n");
}

function unavailableComponent(reason: string, theme: any) {
	return {
		render(width: number): string[] {
			return [
				truncateToWidth(
					theme.fg("warning", `↳ diff unavailable: ${reason}`),
					Math.max(0, width),
					"",
				),
			];
		},
		invalidate() {},
	};
}

export function renderRichToolResult(
	toolName: string,
	result: any,
	options: any,
	theme: any,
	context: any,
	writeMetadata: WriteExecutionMetadataStore,
	/** Plain snapshot or live getter — getter lets /ccstyle panel changes repaint existing diffs. */
	displayConfig: DisplayConfigInput = DEFAULT_TOOL_DISPLAY_CONFIG,
): any | undefined {
	if (options?.isPartial || options?.isError || context?.isError) return undefined;
	const expanded = options?.expanded === true || context?.expanded === true;
	const filePath = context?.args?.file_path ?? context?.args?.path;
	const withFollowUp = (component: any) => {
		if (!expanded || !context?.args?.then_run) return component;
		const content = Array.isArray(result?.content)
			? result.content.filter(
					(block: any) =>
						block?.type === "text" &&
						typeof block.text === "string" &&
						block.text.startsWith("[then_run:succeeded]"),
				)
			: [];
		if (!content.length) return component;
		const followUp = new Text(theme.fg("toolOutput", textFromResult({ content })), 0, 0);
		return {
			...component,
			render: (width: number) => [...component.render(width), ...followUp.render(width)],
			invalidate() {
				component.invalidate?.();
				followUp.invalidate();
			},
		};
	};
	if (toolName === "edit") {
		return withFollowUp(
			renderEditDiffResult(
				result?.details,
				{
					expanded,
					filePath,
					isHovered: options?.isHovered,
					invalidate: () => context?.invalidate?.(),
				},
				displayConfig,
				theme,
				resultText(result),
			),
		);
	}
	if (toolName !== "write") return undefined;
	// 让位点：write 归其他扩展时不提供富 diff，交回普通结果行。
	if (!ownsWriteTool()) return undefined;

	const metadata = writeMetadata.get(context?.toolCallId);
	if (!metadata) {
		return withFollowUp(unavailableComponent("execution metadata is unavailable", theme));
	}
	if (metadata.diffUnavailableReason) {
		return withFollowUp(unavailableComponent(metadata.diffUnavailableReason, theme));
	}
	return withFollowUp(
		renderWriteDiffResult(
			typeof context?.args?.content === "string" ? context.args.content : undefined,
			{
				expanded,
				filePath,
				previousContent: metadata.previousContent,
				fileExistedBeforeWrite: metadata.fileExistedBeforeWrite,
				isHovered: options?.isHovered,
				invalidate: () => context?.invalidate?.(),
			},
			displayConfig,
			theme,
			resultText(result),
		),
	);
}

/** write 被其他扩展占用时的来源及可选元数据协作入口。 */
export type ExternalWriteOwner = {
	source: string;
	path: string;
	installMetadataObserver?: unknown;
};

type WriteOwnershipState = {
	/** write 的执行元数据是否归本插件；undefined 表示尚未确认，按拥有处理。 */
	owned?: boolean;
};

function writeOwnership(): WriteOwnershipState {
	return patchRegistry.ensure<WriteOwnershipState>(WRITE_OWNERSHIP_SLOT, () => ({}));
}

/**
 * write 的执行元数据是否归本插件（自有 write 或协作扩展提供）。
 * 否则渲染层放行给普通结果行，避免每张卡降级成 "diff unavailable"。
 */
export function ownsWriteTool(): boolean {
	return writeOwnership().owned !== false;
}

/** 当前占用 write 的其他扩展；builtin 或未注册时返回 undefined。 */
function findExternalWriteOwner(pi: ExtensionAPI): ExternalWriteOwner | undefined {
	try {
		const tools = pi.getAllTools() as any[];
		const write = tools?.find((tool: any) => tool?.name === "write") as any;
		const sourceInfo = write?.sourceInfo;
		const source = sourceInfo?.source;
		if (!write || typeof source !== "string" || source === "builtin") return undefined;
		return {
			source,
			path: typeof sourceInfo?.path === "string" ? sourceInfo.path : "",
			installMetadataObserver: write.annotations?.[WRITE_METADATA_OBSERVER],
		};
	} catch {
		// getAllTools 在扩展运行时绑定前不可用。
		return undefined;
	}
}

export function installWriteOverride(
	pi: ExtensionAPI,
	store = new WriteExecutionMetadataStore(),
	/** write 已被其他扩展占用时回调一次，调用方据此提示冲突。 */
	onExternalOwner?: (owner: ExternalWriteOwner) => void,
): WriteExecutionMetadataStore {
	if (typeof (pi as any).registerTool !== "function") return store;
	const state = writeOwnership();
	const external = findExternalWriteOwner(pi);
	if (external) {
		const installObserver = external.installMetadataObserver;
		if (
			typeof installObserver === "function" &&
			installObserver(async (toolCallId: string, path: string, write: () => Promise<void>) => {
				store.delete(toolCallId);
				const metadata = await capturePreviousContent(path);
				await write();
				store.set(toolCallId, metadata);
			}) === true
		) {
			// 协作扩展保留工具执行，本插件只接收队列内捕获的写入元数据。
			state.owned = true;
			return store;
		}
		// 让位：执行与 diff 都归对方，渲染层据 owned=false 走普通结果行。
		state.owned = false;
		onExternalOwner?.(external);
		return store;
	}
	state.owned = true;
	const nativeWrite = createWriteToolDefinition(process.cwd()) as any;
	pi.registerTool({
		...nativeWrite,
		async execute(
			toolCallId: string,
			params: { path: string; content: string },
			signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: { cwd: string },
		) {
			return executeWriteWithMetadata(store, toolCallId, params, signal, ctx.cwd);
		},
	});
	return store;
}

export {
	DEFAULT_TOOL_DISPLAY_CONFIG,
	type ToolDisplayConfig,
	type DiffViewMode,
	type DiffIndicatorMode,
} from "../../../config/config.ts";
export type { DisplayConfigInput } from "./diff-renderer.ts";
export { WriteExecutionMetadataStore } from "./write-execution.ts";
