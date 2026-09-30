// Entry point for `npm run check`: every lint, type, boundary, clone, test and
// build check for both apps. Runs first-time setup first, like `npm run dev`.

import { spawnSync } from "node:child_process";
import {
	BACKEND_DIR,
	FRONTEND_DIR,
	VENV_PYTHON,
	style,
} from "./dev/services.mjs";
import { runSetup, SetupError } from "./dev/setup.mjs";

const npmCli = process.env.npm_execpath;
const npm = (script) => ({
	file: npmCli ? process.execPath : "npm",
	args: npmCli
		? [npmCli, "run", "--silent", script]
		: ["run", "--silent", script],
	cwd: FRONTEND_DIR,
});
const python = (...args) => ({ file: VENV_PYTHON, args, cwd: BACKEND_DIR });

const CHECKS = [
	["Frontend lint", npm("lint")],
	["Frontend types", npm("typecheck")],
	["Frontend format", npm("format:check")],
	["Duplicate code", npm("clones")],
	["Frontend build", npm("build")],
	[
		"Backend format",
		python("-m", "black", "--check", "--quiet", "ppe_api", "tests", "api.py"),
	],
	[
		"Backend boundaries",
		python(
			"-c",
			"import sys; from importlinter.cli import lint_imports; sys.exit(lint_imports())",
		),
	],
	["Backend tests", python("-m", "pytest", "-q", "-p", "no:cacheprovider")],
];

try {
	runSetup();
} catch (error) {
	if (!(error instanceof SetupError)) throw error;
	console.error(`\n  ${style.red("✗")} ${error.message}\n`);
	process.exit(1);
}

const failed = [];
for (const [name, { file, args, cwd }] of CHECKS) {
	console.log(`\n${style.bold(`▶ ${name}`)}`);
	const result = spawnSync(file, args, {
		cwd,
		stdio: "inherit",
		shell: file === "npm" && process.platform === "win32",
	});
	if (result.status !== 0) failed.push(name);
}

console.log();
if (failed.length) {
	console.error(`  ${style.red("✗")} Failed: ${failed.join(", ")}\n`);
	process.exit(1);
}
console.log(`  ${style.green("✓")} All ${CHECKS.length} checks passed\n`);
