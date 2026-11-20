/**
 * agent-badge.ts — pi-subagents agent badges on ccstyle tool rows.
 *
 * The color math mirrors pi-subagents/src/agent-color.ts (pure ANSI geometry:
 * palette names, hex, 256-color quantization, WCAG contrast). It is copied
 * rather than imported because the two packages must stay independently
 * installable; keep the copies in sync when that file changes.
 *
 * The type→color table is NOT copied: it lives in pi-subagents' registry, so
 * this module pulls it over the event bus (`subagents:rpc:list-agents`) once
 * per session — on `subagents:ready` — and again on `subagents:agents-changed`
 * (a mid-session ephemeral registration). Without an answer the cache stays
 * empty and rows render exactly as before.
 */

/** The slice of pi's event bus the list-agents client needs. */
export interface BadgeEvents {
	on(event: string, handler: (data: unknown) => void): () => void;
	emit(event: string, data: unknown): void;
}

/** Same theme shape pi-subagents' badge renderer takes. */
export interface BadgeTheme {
	fg(color: string, text: string): string;
	bold?(text: string): string;
	getColorMode?(): "truecolor" | "256color";
}

// ---- Color math (mirrored; see the header) ----

export const NAMED_AGENT_COLORS: Readonly<Record<string, string>> = {
	red: "#DC2626",
	blue: "#6A9BCC",
	green: "#16A34A",
	yellow: "#CA8A04",
	purple: "#827DBD",
	orange: "#D97757",
	pink: "#C46686",
	cyan: "#0891B2",
	amber: "#F59E0B",
	teal: "#008080",
	indigo: "#6366F1",
	gold: "#EAB308",
	"neon-green": "#10B981",
	"neon-cyan": "#06B6D4",
	"metallic-blue": "#3B82F6",
	violet: "#8B5CF6",
	rose: "#F43F5E",
	lime: "#84CC16",
	gray: "#6B7280",
	grey: "#6B7280",
	fuchsia: "#D946EF",
	slate: "#64748B",
	navy: "#1E3A8A",
};

const CUBE_VALUES = [0, 95, 135, 175, 215, 255];
const GRAY_VALUES = Array.from({ length: 24 }, (_, i) => 8 + i * 10);
const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

type Rgb = { r: number; g: number; b: number };

export function resolveAgentColor(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const normalized = value.trim().toLowerCase();
	const resolved = NAMED_AGENT_COLORS[normalized] ?? normalized;
	return /^#[0-9a-f]{6}$/i.test(resolved) ? resolved.toUpperCase() : undefined;
}

function parseHex(hex: string): Rgb {
	return {
		r: Number.parseInt(hex.slice(1, 3), 16),
		g: Number.parseInt(hex.slice(3, 5), 16),
		b: Number.parseInt(hex.slice(5, 7), 16),
	};
}

function nearest(values: readonly number[], value: number): number {
	return values.reduce(
		(best, v, i) => (Math.abs(value - v) < Math.abs(value - values[best]) ? i : best),
		0,
	);
}

function rgbTo256({ r, g, b }: Rgb): { index: number; rgb: Rgb } {
	const [rIndex, gIndex, bIndex] = [r, g, b].map((channel) => nearest(CUBE_VALUES, channel));
	const distance = ({ r: cr, g: cg, b: cb }: Rgb) =>
		0.299 * (r - cr) ** 2 + 0.587 * (g - cg) ** 2 + 0.114 * (b - cb) ** 2;
	const grayIndex = nearest(GRAY_VALUES, Math.round(0.299 * r + 0.587 * g + 0.114 * b));
	const gray = { r: GRAY_VALUES[grayIndex], g: GRAY_VALUES[grayIndex], b: GRAY_VALUES[grayIndex] };
	const cube = { r: CUBE_VALUES[rIndex], g: CUBE_VALUES[gIndex], b: CUBE_VALUES[bIndex] };
	if (Math.max(r, g, b) - Math.min(r, g, b) < 10 && distance(gray) < distance(cube)) {
		return { index: 232 + grayIndex, rgb: gray };
	}
	return { index: 16 + 36 * rIndex + 6 * gIndex + bIndex, rgb: cube };
}

function relativeLuminance({ r, g, b }: Rgb): number {
	const linear = (value: number) => {
		const channel = value / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Render one name as a padded background badge; plain text when no valid color. */
export function renderAgentBadge(
	name: string,
	color: string | undefined,
	theme: BadgeTheme,
): string {
	const resolved = resolveAgentColor(color);
	if (!resolved) return name;
	const rgb = parseHex(resolved);
	const quantized =
		(theme.getColorMode?.() ?? "truecolor") === "256color" ? rgbTo256(rgb) : undefined;
	const shown = quantized?.rgb ?? rgb;
	const contrasting = relativeLuminance(shown) > 0.179 ? BLACK : WHITE;
	const label = theme.bold ? theme.bold(` ${name} `) : ` ${name} `;
	// fg 与 bg 合并在同一个 SGR、以全量 reset 收尾：ccstyle 的行重绘器
	// （stripBackgroundAnsi）只剥以背景码开头的转义，合并序列原样存活；它又在
	// 每个 \u001b[0m 后补回行底色，所以徽章结尾用 0m 而不是 39m/49m —— 后者的
	// 49m 被剥掉后徽章底色会一直铺到行尾。
	const fgPart = quantized
		? `38;5;${rgbTo256(contrasting).index}`
		: `38;2;${contrasting.r};${contrasting.g};${contrasting.b}`;
	const bgPart = quantized ? `48;5;${quantized.index}` : `48;2;${rgb.r};${rgb.g};${rgb.b}`;
	return `\u001b[${fgPart};${bgPart}m${label}\u001b[0m`;
}

// ---- Cache + bus client ----

type AgentBadgeInfo = { displayName?: string; color?: string };

/** type (lowercased) → the label and color pi-subagents reported. */
const badgeCache = new Map<string, AgentBadgeInfo>();

function fillCache(agents: Array<Record<string, unknown>>): void {
	badgeCache.clear();
	for (const agent of agents) {
		if (typeof agent?.name !== "string") continue;
		badgeCache.set(agent.name.toLowerCase(), {
			displayName: typeof agent.displayName === "string" ? agent.displayName : undefined,
			color: typeof agent.color === "string" ? agent.color : undefined,
		});
	}
}

async function fetchAgentBadges(events: BadgeEvents, timeoutMs = 2000): Promise<void> {
	const requestId = `ccstyle-badges-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const channel = `subagents:rpc:list-agents:reply:${requestId}`;
	return new Promise((resolve) => {
		let timer: ReturnType<typeof setTimeout>;
		// Silence or a bad reply clears the cache: a session where pi-subagents is
		// filtered out must fall back to plain rows, not keep the previous
		// session's colors for types that can no longer spawn. (Replies arrive in
		// pull order on this in-process bus, so an older snapshot can never
		// overwrite a newer one; timeouts unsubscribe, so a late reply is dropped.)
		const clearAndResolve = () => {
			badgeCache.clear();
			resolve();
		};
		const unsub = events.on(channel, (raw) => {
			clearTimeout(timer);
			unsub();
			const reply = raw as
				| { success: true; data?: { agents?: Array<Record<string, unknown>> } }
				| { success: false };
			// A malformed envelope is silence, not a crash inside the bus dispatch.
			if (!raw || typeof raw !== "object" || typeof reply.success !== "boolean") {
				clearAndResolve();
				return;
			}
			if (reply.success && Array.isArray(reply.data?.agents)) fillCache(reply.data.agents);
			else clearAndResolve();
		});
		timer = setTimeout(() => {
			unsub();
			clearAndResolve();
		}, timeoutMs);
		events.emit("subagents:rpc:list-agents", { requestId });
	});
}

let unsubscribeBadges: (() => void) | undefined;

/**
 * Subscribe the cache to pi-subagents' lifecycle: pull on ready, re-pull when
 * the spawnable set changes. Idempotent — a second invocation replaces the
 * first subscription, so repeated factory runs (integration tests) never
 * stack listeners. The subscriptions live for the process; subagents:ready
 * re-fires per session.
 */
export function initAgentBadges(events: BadgeEvents | undefined, timeoutMs = 2000): () => void {
	// Headless hosts and test harnesses may expose no bus; without one there is
	// nothing to pull and rows simply stay plain.
	if (!events?.on || !events.emit) return () => {};
	unsubscribeBadges?.();
	const pull = () => {
		void fetchAgentBadges(events, timeoutMs);
	};
	const unsubReady = events.on("subagents:ready", pull);
	const unsubChanged = events.on("subagents:agents-changed", pull);
	unsubscribeBadges = () => {
		unsubReady();
		unsubChanged();
	};
	return unsubscribeBadges;
}

/** Drop the cached table (tests and the session-start refresh use this). */
export function clearAgentBadges(): void {
	badgeCache.clear();
}

/** Pull the table now. The renderer calls this on its own session_start: a
 * present pi-subagents refills regardless of handler order (its own ready pull
 * may have run before ours), and an absent one leaves the timeout's clear in
 * place — so a filtered-out session starts plain instead of keeping the
 * previous session's colors. */
export function refreshAgentBadges(events: BadgeEvents | undefined): void {
	if (!events?.on || !events.emit) return;
	void fetchAgentBadges(events);
}

/** A styled badge for a spawnable type, or undefined when its color is unknown. */
export function agentBadge(type: string, theme: BadgeTheme): string | undefined {
	const info = badgeCache.get(type.toLowerCase());
	// A configured-but-invalid color is "no badge" (same rule as pi-subagents'
	// hasAgentBadge), so the row keeps its normal toolTitle rendering instead of
	// a bare unstyled name.
	if (!info?.color || !resolveAgentColor(info.color)) return undefined;
	return renderAgentBadge(info.displayName || type, info.color, theme);
}
