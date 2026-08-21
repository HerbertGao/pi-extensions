export type DiffViewMode = "auto" | "split" | "unified";
export type DiffIndicatorMode = "bars" | "classic" | "none";

export interface ToolDisplayConfig {
	diffViewMode: DiffViewMode;
	diffIndicatorMode: DiffIndicatorMode;
	diffSplitMinWidth: number;
	editDiffCollapsedLines: number;
	/** Write-only collapsed body lines. 0 = `↳ created • click to show more`. */
	writeDiffCollapsedLines: number;
	diffWordWrap: boolean;
	expandedPreviewMaxLines: number;
}

export const DEFAULT_TOOL_DISPLAY_CONFIG: ToolDisplayConfig = {
	diffViewMode: "auto",
	diffIndicatorMode: "bars",
	diffSplitMinWidth: 120,
	/** Collapsed edit/diff body: ~half a typical terminal after chrome. */
	editDiffCollapsedLines: 24,
	/** Write create/overwrite collapsed body; 0 shows only the expand hint. */
	writeDiffCollapsedLines: 0,
	diffWordWrap: true,
	/**
	 * Expanded tool/diff body cap. 40 ≈ one screen of content after title,
	 * Input section, editor, and status — keeps the TUI compact.
	 * Raise via /ccstyle → Diff → Expanded max lines when reviewing large dumps.
	 */
	expandedPreviewMaxLines: 40,
};
