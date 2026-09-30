const ANSI_SGR_PATTERN = /\x1b\[([0-9;:]*)m/g;
const STYLE_RESET_PARAMS = [39, 22, 23, 24, 25, 27, 28, 29, 59] as const;

export { ANSI_SGR_PATTERN, STYLE_RESET_PARAMS };

export function expandSgrReset(param: number): readonly number[] | undefined {
	return param === 0 ? STYLE_RESET_PARAMS : undefined;
}

export function toSgrParams(rawParams: string): number[] {
	if (!rawParams.trim()) {
		return [0];
	}

	const parsed = rawParams
		.split(";")
		.map((token) => Number.parseInt(token, 10))
		.filter((value) => Number.isFinite(value));

	return parsed.length > 0 ? parsed : [];
}

export function isFiniteSgrParam(value: number | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

export function readSgrColorSequence(params: number[], index: number): number[] | undefined {
	const param = params[index];
	if (param !== 38 && param !== 48) {
		return undefined;
	}

	const colorMode = params[index + 1];
	if (colorMode === 5) {
		const colorValue = params[index + 2];
		return isFiniteSgrParam(colorValue) ? [param, colorMode, colorValue] : undefined;
	}

	if (colorMode === 2) {
		const red = params[index + 2];
		const green = params[index + 3];
		const blue = params[index + 4];
		return isFiniteSgrParam(red) && isFiniteSgrParam(green) && isFiniteSgrParam(blue)
			? [param, colorMode, red, green, blue]
			: undefined;
	}

	return undefined;
}

export function stripBackgroundSgrParams(params: readonly number[]): number[] {
	const sanitized: number[] = [];

	for (let index = 0; index < params.length; index++) {
		const param = params[index] ?? 0;

		if (param === 0) {
			sanitized.push(...expandSgrReset(param)!);
			continue;
		}

		if (param === 49 || (param >= 40 && param <= 47) || (param >= 100 && param <= 107)) {
			continue;
		}

		if (param === 38 || param === 48) {
			const sequence = readSgrColorSequence(params as number[], index);
			if (sequence) {
				if (param === 38) {
					sanitized.push(...sequence);
				}
				index += sequence.length - 1;
				continue;
			}
			const advance = params[index + 1] === 5 ? 2 : params[index + 1] === 2 ? 4 : 0;
			if (advance > 0) {
				index += advance;
				if (param === 38) {
					sanitized.push(param);
				}
				continue;
			}
		}

		sanitized.push(param);
	}

	return sanitized;
}

function isKeptColonSgr(token: string): boolean {
	const parts = token.split(":");
	if (parts[0] === "48") return false;
	if (parts[0] !== "38") return true;
	const channels =
		parts[1] === "5" && parts.length === 3
			? parts.slice(2)
			: parts[1] === "2" && (parts.length === 5 || parts.length === 6)
				? parts.slice(-3)
				: undefined;
	return !!channels?.every((c) => /^\d+$/.test(c) && Number(c) <= 255);
}

export function filterSgrSequences(text: string, filter: (params: number[]) => number[]): string {
	if (!text || !text.includes("\x1b[")) {
		return text;
	}

	return text.replace(ANSI_SGR_PATTERN, (_sequence, rawParams: string) => {
		if (rawParams.includes(":")) {
			// 冒号形式 (ISO 8613-6)：逐段处理；去掉 48:*，校验 38:*，其余原样保留
			const kept = rawParams.split(";").flatMap((token) => {
				if (!token.includes(":")) {
					return token ? filter(toSgrParams(token)).map(String) : [];
				}
				return isKeptColonSgr(token) ? [token] : [];
			});
			return kept.length > 0 ? `\x1b[${kept.join(";")}m` : "";
		}
		const parsed = toSgrParams(rawParams);
		if (parsed.length === 0) {
			return "";
		}

		const sanitized = filter(parsed);
		if (sanitized.length === 0) {
			return "";
		}

		return `\x1b[${sanitized.join(";")}m`;
	});
}

export function sanitizeAnsiForThemedOutput(text: string): string {
	return filterSgrSequences(text, stripBackgroundSgrParams);
}
