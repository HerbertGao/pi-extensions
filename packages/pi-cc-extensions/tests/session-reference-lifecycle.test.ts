import assert from "node:assert/strict";
import test from "node:test";
import { SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";
import type { AutocompleteProvider, AutocompleteSuggestions } from "@earendil-works/pi-tui";
import sessionReferenceExtension from "../extensions/feature/reference/index.ts";

const noFiles: AutocompleteProvider = {
	async getSuggestions() {
		return null;
	},
	applyCompletion(lines, cursorLine, cursorCol) {
		return { lines, cursorLine, cursorCol };
	},
};

type LifecycleState = {
	stale: boolean;
	staleCwdAccesses: number;
	staleUiAccesses: number;
};

type Harness = {
	handlers: Map<string, Function>;
	providers: AutocompleteProvider[];
	notifications: string[];
	baseProvider: AutocompleteProvider;
};

function createHarness(baseProvider = noFiles): Harness {
	const handlers = new Map<string, Function>();
	const providers: AutocompleteProvider[] = [];
	const notifications: string[] = [];
	sessionReferenceExtension({
		on(name: string, handler: Function) {
			handlers.set(name, handler);
		},
		events: { on: () => () => {} },
		registerMessageRenderer() {},
	} as any);
	return { handlers, providers, notifications, baseProvider };
}

function createContext(harness: Harness, id = "current-session") {
	const state: LifecycleState = { stale: false, staleCwdAccesses: 0, staleUiAccesses: 0 };
	const ctx = {
		mode: "tui",
		get cwd() {
			if (state.stale) {
				state.staleCwdAccesses++;
				throw new Error("STALE_CWD");
			}
			return "/repo";
		},
		sessionManager: {
			getSessionId: () => id,
			getSessionFile: () => undefined,
		},
		ui: {
			addAutocompleteProvider(factory: (current: AutocompleteProvider) => AutocompleteProvider) {
				if (state.stale) {
					state.staleUiAccesses++;
					return;
				}
				harness.providers.push(factory(harness.baseProvider));
			},
			notify(message: string) {
				if (state.stale) {
					state.staleUiAccesses++;
					return;
				}
				harness.notifications.push(message);
			},
		},
	};
	return { ctx, state };
}

function sessionInfo(id: string): SessionInfo {
	const date = new Date("2025-01-02T03:04:05.000Z");
	return {
		path: `/sessions/${id}.jsonl`,
		id,
		cwd: "/repo",
		created: date,
		modified: date,
		messageCount: 1,
		firstMessage: "previous work",
		allMessagesText: "previous work",
	};
}

function tick() {
	return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

test("session autocomplete drops in-flight work after session shutdown", {
	concurrency: false,
}, async () => {
	const originalListAll = SessionManager.listAll;
	let release!: (sessions: SessionInfo[]) => void;
	const pendingSessions = new Promise<SessionInfo[]>((resolve) => {
		release = resolve;
	});
	const harness = createHarness();
	const { ctx, state } = createContext(harness);
	SessionManager.listAll = (() => pendingSessions) as typeof SessionManager.listAll;

	try {
		await harness.handlers.get("session_start")?.({}, ctx);
		await tick();
		assert.equal(harness.providers.length, 1);

		const suggestions = harness.providers[0]!.getSuggestions(["@"], 0, 1, {
			signal: new AbortController().signal,
		});
		await Promise.resolve();
		await harness.handlers.get("session_shutdown")?.({}, ctx);
		state.stale = true;
		release([]);

		assert.equal(await suggestions, null);
		assert.equal(state.staleCwdAccesses, 0);
		assert.equal(state.staleUiAccesses, 0);
	} finally {
		release([]);
		SessionManager.listAll = originalListAll;
	}
});

test("session autocomplete drops work when a new session start supersedes it", {
	concurrency: false,
}, async () => {
	const originalListAll = SessionManager.listAll;
	let releaseFirst!: (sessions: SessionInfo[]) => void;
	const firstPending = new Promise<SessionInfo[]>((resolve) => {
		releaseFirst = resolve;
	});
	let calls = 0;
	SessionManager.listAll = (() => {
		calls++;
		return calls === 1 ? firstPending : Promise.resolve([]);
	}) as typeof SessionManager.listAll;
	const harness = createHarness();
	const first = createContext(harness, "first-session");
	const second = createContext(harness, "second-session");

	try {
		await harness.handlers.get("session_start")?.({}, first.ctx);
		await tick();
		const suggestions = harness.providers[0]!.getSuggestions(["@"], 0, 1, {
			signal: new AbortController().signal,
		});
		await Promise.resolve();

		await harness.handlers.get("session_start")?.({}, second.ctx);
		first.state.stale = true;
		releaseFirst([sessionInfo("old-session")]);

		assert.equal(await suggestions, null);
		assert.equal(first.state.staleCwdAccesses, 0);
		await tick();
		assert.equal(harness.providers.length, 2);
	} finally {
		releaseFirst([]);
		await harness.handlers.get("session_shutdown")?.({}, second.ctx);
		SessionManager.listAll = originalListAll;
	}
});

test("autocomplete drops stale session results when the file provider is still pending", {
	concurrency: false,
}, async () => {
	const originalListAll = SessionManager.listAll;
	let releaseBase!: (suggestions: AutocompleteSuggestions | null) => void;
	const pendingBase = new Promise<AutocompleteSuggestions | null>((resolve) => {
		releaseBase = resolve;
	});
	const baseProvider: AutocompleteProvider = {
		async getSuggestions() {
			return pendingBase;
		},
		applyCompletion(lines, cursorLine, cursorCol) {
			return { lines, cursorLine, cursorCol };
		},
	};
	SessionManager.listAll = (() =>
		Promise.resolve([sessionInfo("old-session")])) as typeof SessionManager.listAll;
	const harness = createHarness(baseProvider);
	const { ctx, state } = createContext(harness);

	try {
		await harness.handlers.get("session_start")?.({}, ctx);
		await tick();
		const suggestions = harness.providers[0]!.getSuggestions(["@"], 0, 1, {
			signal: new AbortController().signal,
		});
		await Promise.resolve();
		await harness.handlers.get("session_shutdown")?.({}, ctx);
		state.stale = true;
		releaseBase(null);

		assert.equal(await suggestions, null);
		assert.equal(state.staleCwdAccesses, 0);
		assert.equal(state.staleUiAccesses, 0);
	} finally {
		releaseBase(null);
		SessionManager.listAll = originalListAll;
	}
});

test("stale before_agent_start rejection does not notify or register a provider", {
	concurrency: false,
}, async () => {
	const originalListAll = SessionManager.listAll;
	let rejectPending!: (reason?: unknown) => void;
	const pendingSessions = new Promise<SessionInfo[]>((_, reject) => {
		rejectPending = reject;
	});
	const harness = createHarness();
	const { ctx, state } = createContext(harness);
	SessionManager.listAll = (() => pendingSessions) as typeof SessionManager.listAll;

	try {
		await harness.handlers.get("session_start")?.({}, ctx);
		const beforeStart = harness.handlers.get("before_agent_start")?.(
			{ prompt: "include @session:missing" },
			ctx,
		);
		await Promise.resolve();
		await harness.handlers.get("session_shutdown")?.({}, ctx);
		state.stale = true;
		rejectPending(new Error("load failed"));

		assert.equal(await beforeStart, undefined);
		await tick();
		assert.equal(harness.providers.length, 0);
		assert.equal(harness.notifications.length, 0);
		assert.equal(state.staleCwdAccesses, 0);
		assert.equal(state.staleUiAccesses, 0);
	} finally {
		rejectPending();
		SessionManager.listAll = originalListAll;
	}
});

test("fallback before_agent_start ignores a stale listAll rejection", {
	concurrency: false,
}, async () => {
	const originalListAll = SessionManager.listAll;
	let rejectPending!: (reason?: unknown) => void;
	const pendingSessions = new Promise<SessionInfo[]>((_, reject) => {
		rejectPending = reject;
	});
	const harness = createHarness();
	const { ctx, state } = createContext(harness);
	SessionManager.listAll = (() => pendingSessions) as typeof SessionManager.listAll;

	try {
		const beforeStart = harness.handlers.get("before_agent_start")?.(
			{ prompt: "include @session:missing" },
			ctx,
		);
		await Promise.resolve();
		await harness.handlers.get("session_shutdown")?.({}, ctx);
		state.stale = true;
		rejectPending(new Error("load failed"));

		assert.equal(await beforeStart, undefined);
		assert.equal(state.staleUiAccesses, 0);
	} finally {
		rejectPending();
		SessionManager.listAll = originalListAll;
	}
});

test("before_agent_start drops resolved fallback work after session replacement", {
	concurrency: false,
}, async () => {
	const originalListAll = SessionManager.listAll;
	let release!: (sessions: SessionInfo[]) => void;
	const pendingSessions = new Promise<SessionInfo[]>((resolve) => {
		release = resolve;
	});
	const harness = createHarness();
	const first = createContext(harness, "first-session");
	const second = createContext(harness, "second-session");
	SessionManager.listAll = (() => pendingSessions) as typeof SessionManager.listAll;

	try {
		const beforeStart = harness.handlers.get("before_agent_start")?.(
			{ prompt: "include @session:missing" },
			first.ctx,
		);
		await Promise.resolve();
		await harness.handlers.get("session_start")?.({}, second.ctx);
		first.state.stale = true;
		release([sessionInfo("old-session")]);

		assert.equal(await beforeStart, undefined);
		assert.equal(first.state.staleCwdAccesses, 0);
		assert.equal(first.state.staleUiAccesses, 0);
	} finally {
		release([]);
		await harness.handlers.get("session_shutdown")?.({}, second.ctx);
		SessionManager.listAll = originalListAll;
	}
});

test("a cancelled session switch preserves the current reference loader", {
	concurrency: false,
}, async () => {
	const originalListAll = SessionManager.listAll;
	let listCalls = 0;
	SessionManager.listAll = (() => {
		listCalls++;
		return Promise.resolve([]);
	}) as typeof SessionManager.listAll;
	const harness = createHarness();
	const { ctx } = createContext(harness);

	try {
		await harness.handlers.get("session_start")?.({}, ctx);
		await tick();
		assert.equal(listCalls, 1);
		await harness.handlers.get("session_before_switch")?.({}, ctx);
		assert.equal(
			await harness.handlers.get("before_agent_start")?.(
				{ prompt: "include @session:missing" },
				ctx,
			),
			undefined,
		);
		assert.equal(listCalls, 1);
		assert.deepEqual(harness.notifications, [
			"session-reference: referenced sessions were not found",
		]);
	} finally {
		await harness.handlers.get("session_shutdown")?.({}, ctx);
		SessionManager.listAll = originalListAll;
	}
});
