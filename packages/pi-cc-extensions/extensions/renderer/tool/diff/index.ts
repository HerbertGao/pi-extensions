import { createWriteToolDefinition, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import {
	renderEditDiffResult,
	renderWriteDiffResult,
	type DisplayConfigInput,
} from "./diff-renderer.ts";
import { DEFAULT_TOOL_DISPLAY_CONFIG } from "./types.ts";
import { executeWriteWithMetadata, WriteExecutionMetadataStore } from "./write-execution.ts";

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
	if (toolName === "edit") {
		return renderEditDiffResult(
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
		);
	}
	if (toolName !== "write") return undefined;
	// Yield point: when another extension owns write there is no execution metadata; fall back to the plain result row.
	if (!ownsWriteTool()) return undefined;

	const metadata = writeMetadata.get(context?.toolCallId);
	if (!metadata) {
		return unavailableComponent("execution metadata is unavailable", theme);
	}
	if (metadata.diffUnavailableReason) {
		return unavailableComponent(metadata.diffUnavailableReason, theme);
	}
	return renderWriteDiffResult(
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
	);
}

/** Extension currently owning write, reported in the conflict notice. */
export type ExternalWriteOwner = { source: string; path: string };

const WRITE_OWNERSHIP_SLOT = Symbol.for("pi.ccstyle.write-ownership");
/** Parameters object of the write override registered by this module; identifies our own tool in getAllTools(). */
let ownWriteParameters: unknown;

function writeOwnership(): { owned?: boolean } {
	const slots = globalThis as any;
	slots[WRITE_OWNERSHIP_SLOT] ??= {};
	return slots[WRITE_OWNERSHIP_SLOT];
}

/** Whether this package executes write; unknown ownership keeps the existing rich-diff behavior. */
export function ownsWriteTool(): boolean {
	return writeOwnership().owned !== false;
}

function findExternalWriteOwner(pi: ExtensionAPI): ExternalWriteOwner | undefined {
	try {
		const tools = pi.getAllTools() as any[];
		const write = tools?.find((tool: any) => tool?.name === "write") as any;
		const sourceInfo = write?.sourceInfo;
		const source = sourceInfo?.source;
		if (!write || typeof source !== "string" || source === "builtin") return undefined;
		// Our own override from an earlier session_start in this runtime.
		if (ownWriteParameters !== undefined && write.parameters === ownWriteParameters)
			return undefined;
		return { source, path: typeof sourceInfo?.path === "string" ? sourceInfo.path : "" };
	} catch {
		// getAllTools is unavailable before the extension runtime is bound.
		return undefined;
	}
}

export function installWriteOverride(
	pi: ExtensionAPI,
	store = new WriteExecutionMetadataStore(),
	/** Called when another extension already owns write. */
	onExternalOwner?: (owner: ExternalWriteOwner) => void,
): WriteExecutionMetadataStore {
	if (typeof (pi as any).registerTool !== "function") return store;
	const state = writeOwnership();
	const external = findExternalWriteOwner(pi);
	if (external) {
		state.owned = false;
		onExternalOwner?.(external);
		return store;
	}
	state.owned = true;
	const nativeWrite = createWriteToolDefinition(process.cwd()) as any;
	ownWriteParameters = nativeWrite.parameters;
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
} from "./types.ts";
export type { DisplayConfigInput } from "./diff-renderer.ts";
export { WriteExecutionMetadataStore } from "./write-execution.ts";
