import {
	BranchSummaryMessageComponent,
	CompactionSummaryMessageComponent,
	SkillInvocationMessageComponent,
} from "@earendil-works/pi-coding-agent";
import { Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { config } from "../config/config.ts";
import { showMoreHintText } from "./show-more-hint.ts";

/**
 * 接管三个消息组件（`<skill>` 块、压缩摘要、分支摘要），ccstyle on 时渲染为
 * 与工具调用一致的单行风格（● Title · hint），off 时回退原生。
 *
 * 三者结构同构：Box + markdownTheme + updateDisplay，构造/setExpanded/invalidate
 * 三条路径都经过 updateDisplay，patch 一处即可全覆盖。它们不走
 * ToolExecutionComponent，无法复用其原型 patch，这里单独统一管理。
 */

const MESSAGE_DISPLAY_PATCH = Symbol.for("pi.ccstyle.message-display-patch");
const MESSAGE_DISPLAY_ORIGINAL_BG = Symbol.for("pi.ccstyle.message-display-original-bg");
const MESSAGE_DISPLAY_ORIGINAL_PADDING = Symbol.for("pi.ccstyle.message-display-original-padding");
const MESSAGE_DISPLAY_ORIGINAL_SAVED = Symbol.for("pi.ccstyle.message-display-original-saved");

// 与 renderer/index.ts renderCall 的成功勾一致：亮绿 ✓（truecolor ANSI）。
const BRIGHT_GREEN = "\x1b[38;2;80;220;100m";
const ANSI_FG_RESET = "\x1b[39m";

/** 事件上下文中同步的最新主题（与 toolGrouping.setTheme 同一来源）。 */
let displayTheme: any;

export function setMessageDisplayTheme(theme: any): void {
	displayTheme = theme;
}

/** 供工具展开面板背景等共享同一主题来源（ctx.ui.theme）。 */
export function getMessageDisplayTheme(): any {
	return displayTheme;
}

type DisplayKind = {
	title(component: any): string;
	body(component: any): string;
};

const SKILL_KIND: DisplayKind = {
	title: (component) => `Skill ${String(component.skillBlock?.name ?? "skill")}`,
	body: (component) => String(component.skillBlock?.content ?? ""),
};

const COMPACTION_KIND: DisplayKind = {
	title: (component) =>
		`Compacted from ${Number(component.message?.tokensBefore ?? 0).toLocaleString()} tokens`,
	body: (component) => String(component.message?.summary ?? ""),
};

const BRANCH_KIND: DisplayKind = {
	title: () => "Branch summary",
	body: (component) => String(component.message?.summary ?? ""),
};

function ensureHintHover(component: any): void {
	if (typeof component.setHintHovered === "function") return;
	component.setHintHovered = function (this: any, hovered: boolean) {
		if (this.hintHovered === hovered) return;
		this.hintHovered = hovered;
		this.invalidate?.();
	};
}

function rememberMessageDisplay(component: any): void {
	if (component[MESSAGE_DISPLAY_ORIGINAL_SAVED]) return;
	component[MESSAGE_DISPLAY_ORIGINAL_BG] = component.bgFn;
	component[MESSAGE_DISPLAY_ORIGINAL_PADDING] = [component.paddingX, component.paddingY];
	component[MESSAGE_DISPLAY_ORIGINAL_SAVED] = true;
}

function restoreMessageDisplay(component: any): void {
	if (!component[MESSAGE_DISPLAY_ORIGINAL_SAVED]) return;
	const [paddingX, paddingY] = component[MESSAGE_DISPLAY_ORIGINAL_PADDING];
	component.paddingX = paddingX;
	component.paddingY = paddingY;
	component.setBgFn?.(component[MESSAGE_DISPLAY_ORIGINAL_BG]);
	delete component[MESSAGE_DISPLAY_ORIGINAL_BG];
	delete component[MESSAGE_DISPLAY_ORIGINAL_PADDING];
	delete component[MESSAGE_DISPLAY_ORIGINAL_SAVED];
}

function renderCcstyle(component: any, kind: DisplayKind): boolean {
	const theme = displayTheme;
	if (!theme) return false; // 主题未就绪时回退原生渲染
	rememberMessageDisplay(component);
	if (component.bgFn) component.setBgFn?.(undefined); // 与工具调用一致，去掉灰底
	component.paddingY = 0; // 工具组件 paddingY=0；原生 Box 默认 1，会上下各留一个空行
	component.clear();
	ensureHintHover(component);
	const icon = `${BRIGHT_GREEN}✓${ANSI_FG_RESET}`; // 已完成消息，等同工具成功态
	const title = theme.fg("toolTitle", kind.title(component));
	if (!component.expanded) {
		const hovered = component.hintHovered === true;
		const hint = `${theme.fg("dim", " • ")}${theme.fg(hovered ? "text" : "dim", showMoreHintText())}`;
		component.addChild(new Text(`${icon} ${title}${hint}`, 0, 0));
		return true;
	}
	// 展开卡与 tool 一致：userMessageBg + 上下左右 1 格
	component.paddingX = 1;
	component.paddingY = 1;
	if (typeof theme.bg === "function" && typeof component.setBgFn === "function") {
		component.setBgFn((text: string) => theme.bg("userMessageBg", text));
	}
	component.addChild(new Text(`${icon} ${title}`, 0, 0));
	component.addChild(new Spacer(1));
	component.addChild(
		new Markdown(kind.body(component), 0, 0, component.markdownTheme, {
			color: (text: string) => theme.fg("customMessageText", text),
		}),
	);
	return true;
}

type PatchEntry = {
	prototype: any;
	installed: (...args: any[]) => void;
	original: (...args: any[]) => void;
};

/** patch 三个消息组件的 updateDisplay，返回统一 dispose（/reload 链安全）。 */
export function installMessageDisplayRendering(): () => void {
	const host = globalThis as any;
	const previous = host[MESSAGE_DISPLAY_PATCH];
	if (previous) previous.dispose();
	const patch: {
		active: boolean;
		entries: PatchEntry[];
		components: Set<WeakRef<any>>;
		tracked: WeakSet<object>;
		dispose: () => void;
	} = {
		active: true,
		entries: [],
		components: new Set(),
		tracked: new WeakSet(),
		dispose: () => {},
	};
	const track = (component: object): void => {
		for (const ref of patch.components) {
			if (!ref.deref()) patch.components.delete(ref);
		}
		if (patch.tracked.has(component)) return;
		patch.tracked.add(component);
		patch.components.add(new WeakRef(component));
	};
	const installOne = (ComponentClass: any, kind: DisplayKind): void => {
		const prototype = ComponentClass.prototype;
		const original = prototype.updateDisplay;
		const installed = function (this: any) {
			if (patch.active && config.mode !== "off") {
				try {
					if (renderCcstyle(this, kind)) {
						track(this);
						return;
					}
				} catch {
					// 渲染失败回退原生
				}
			}
			restoreMessageDisplay(this);
			original.call(this);
		};
		prototype.updateDisplay = installed;
		patch.entries.push({ prototype, installed, original });
	};
	installOne(SkillInvocationMessageComponent, SKILL_KIND);
	installOne(CompactionSummaryMessageComponent, COMPACTION_KIND);
	installOne(BranchSummaryMessageComponent, BRANCH_KIND);
	patch.dispose = () => {
		patch.active = false;
		for (const entry of patch.entries) {
			if (entry.prototype.updateDisplay === entry.installed) {
				entry.prototype.updateDisplay = entry.original;
			}
		}
		for (const ref of patch.components) {
			const component = ref.deref();
			if (!component) continue;
			try {
				restoreMessageDisplay(component);
				component.updateDisplay();
			} catch {
				// 单个陈旧组件不应阻断其余原型与组件恢复
			}
		}
		patch.components.clear();
		if (host[MESSAGE_DISPLAY_PATCH] === patch) delete host[MESSAGE_DISPLAY_PATCH];
	};
	host[MESSAGE_DISPLAY_PATCH] = patch;
	return patch.dispose;
}

/** 三个消息组件共享的结构特征；CustomMessageComponent 用 rebuild 无 updateDisplay，不命中。 */
export function isMessageDisplayComponent(value: any): boolean {
	return Boolean(
		value &&
			typeof value === "object" &&
			typeof value.markdownTheme === "object" &&
			typeof value.setExpanded === "function" &&
			typeof value.updateDisplay === "function" &&
			typeof value.clear === "function",
	);
}

/** 遍历当前 transcript，让已挂载的消息组件按当前 mode 重渲染（/ccstyle on|off 切换）。 */
export function refreshMessageDisplays(root: any): void {
	const seen = new Set<any>();
	const visit = (value: any): void => {
		if (!value || typeof value !== "object" || seen.has(value)) return;
		seen.add(value);
		if (Array.isArray(value)) {
			for (const child of value) visit(child);
			return;
		}
		if (isMessageDisplayComponent(value)) {
			value.invalidate?.();
			return;
		}
		const children = value.children;
		if (Array.isArray(children)) {
			for (const child of children) visit(child);
		}
		try {
			const mounted = value.getMountedRoots?.();
			if (Array.isArray(mounted)) {
				for (const root of mounted) visit(root);
			}
		} catch {
			// 惰性 Proxy 可能暂时没有 mounted roots
		}
	};
	visit(root);
}
