import assert from "node:assert/strict";
import test from "node:test";
import { displayPath, formatDisplayPath } from "../extensions/renderer/tool/result.ts";

test("displayPath / formatDisplayPath keep native POSIX and Windows separators", () => {
	assert.equal(displayPath("/home/user/project/src/file.ts", "/home/user/project"), "src/file.ts");
	assert.equal(
		displayPath("C:\\Users\\user\\project\\src\\file.ts", "C:\\Users\\user\\project"),
		"src\\file.ts",
	);

	assert.equal(
		formatDisplayPath("/home/user/project/src/deep/file.ts", "/home/user/project", 12),
		"src…/file.ts",
	);
	assert.equal(
		formatDisplayPath(
			"C:\\Users\\user\\project\\src\\deep\\file.ts",
			"C:\\Users\\user\\project",
			12,
		),
		"src…\\file.ts",
	);
});
