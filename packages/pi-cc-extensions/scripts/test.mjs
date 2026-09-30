import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Upstream tests persist config under PI_CODING_AGENT_DIR (default: the user's real ~/.pi/agent)
// and assert plain text that Pi's highlighter colors when the terminal advertises color support.
const agentDir = mkdtempSync(join(tmpdir(), "pi-cc-test-"));
const result = spawnSync(
	process.execPath,
	["--test", ...process.argv.slice(2), "tests/**/*.test.ts"],
	{
		cwd: resolve(dirname(fileURLToPath(import.meta.url)), ".."),
		env: { ...process.env, FORCE_COLOR: "0", PI_CODING_AGENT_DIR: agentDir },
		stdio: "inherit",
	},
);
rmSync(agentDir, { recursive: true, force: true });
process.exit(result.status ?? 1);
