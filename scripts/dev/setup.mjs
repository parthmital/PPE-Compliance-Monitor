// First-run setup for `npm run dev`. Every step is idempotent: it records a
// hash of the file it installed from and skips the work when nothing changed.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
	BACKEND_DIR,
	FRONTEND_DIR,
	ROOT,
	VENV_DIR,
	VENV_PYTHON,
	style,
} from "./services.mjs";

const MIN_NODE = 18;
const MIN_PYTHON = [3, 10];

export class SetupError extends Error {}

function step(label, detail, ok = true) {
	const mark = ok ? style.green("✓") : style.yellow("!");
	console.log(`  ${mark} ${label.padEnd(22)} ${style.dim(detail)}`);
}

function announce(text) {
	console.log(`  ${style.yellow("…")} ${text}\n`);
}

function fileHash(file) {
	return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function readStamp(file) {
	return existsSync(file) ? readFileSync(file, "utf8").trim() : null;
}

function run(file, args, options = {}) {
	const result = spawnSync(file, args, { stdio: "inherit", ...options });
	if (result.error) throw result.error;
	return result.status === 0;
}

// Run npm through the same npm CLI that invoked this script, so no shell is needed.
function npm(args, cwd) {
	const npmCli = process.env.npm_execpath;
	if (npmCli) return run(process.execPath, [npmCli, ...args], { cwd });
	const result = spawnSync(`npm ${args.join(" ")}`, {
		stdio: "inherit",
		cwd,
		shell: true,
	});
	return result.status === 0;
}

function pythonVersion(file, args) {
	const result = spawnSync(
		file,
		[...args, "-c", "import sys; print('%d.%d.%d' % sys.version_info[:3])"],
		{ encoding: "utf8" },
	);
	if (result.error || result.status !== 0) return null;
	return result.stdout.trim().split(".").map(Number);
}

function isSupported([major, minor]) {
	return (
		major > MIN_PYTHON[0] || (major === MIN_PYTHON[0] && minor >= MIN_PYTHON[1])
	);
}

function findSystemPython() {
	const candidates =
		process.platform === "win32"
			? [
					["py", ["-3"]],
					["python", []],
					["python3", []],
				]
			: [
					["python3", []],
					["python", []],
				];
	for (const [file, args] of candidates) {
		const version = pythonVersion(file, args);
		if (version && isSupported(version)) return { file, args, version };
	}
	throw new SetupError(
		`Python ${MIN_PYTHON.join(".")} or newer was not found on PATH. Install it from https://www.python.org/downloads/ and run \`npm run dev\` again.`,
	);
}

function checkNode() {
	const major = Number(process.versions.node.split(".")[0]);
	if (major < MIN_NODE) {
		throw new SetupError(
			`Node.js ${MIN_NODE} or newer is required (found ${process.versions.node}).`,
		);
	}
	step("Node.js", `v${process.versions.node}`);
}

function ensureFrontendPackages() {
	const lockFile = path.join(FRONTEND_DIR, "package-lock.json");
	const stampFile = path.join(FRONTEND_DIR, "node_modules", ".dev-setup-hash");
	const vite = path.join(
		FRONTEND_DIR,
		"node_modules",
		"vite",
		"bin",
		"vite.js",
	);

	if (existsSync(vite) && readStamp(stampFile) === fileHash(lockFile)) {
		step("Frontend packages", "up to date");
		return;
	}

	announce("Installing frontend packages (npm install)");
	if (!npm(["install", "--no-audit", "--no-fund"], FRONTEND_DIR)) {
		throw new SetupError(
			"npm install failed in Frontend/. See the output above.",
		);
	}
	// npm may normalise the lockfile, so hash it after installing.
	writeFileSync(stampFile, fileHash(lockFile));
	console.log();
	step("Frontend packages", "installed");
}

function ensureVenv() {
	if (existsSync(VENV_PYTHON)) {
		const version = pythonVersion(VENV_PYTHON, []);
		if (!version) {
			throw new SetupError(
				`The virtual environment at ${path.relative(ROOT, VENV_DIR)} is broken. Delete the .venv folder and run \`npm run dev\` again.`,
			);
		}
		step("Python environment", `.venv (Python ${version.join(".")})`);
		return;
	}

	const python = findSystemPython();
	announce(`Creating .venv with Python ${python.version.join(".")}`);
	if (!run(python.file, [...python.args, "-m", "venv", VENV_DIR])) {
		throw new SetupError("Could not create the Python virtual environment.");
	}
	step(
		"Python environment",
		`.venv created (Python ${python.version.join(".")})`,
	);
}

function ensurePythonPackages() {
	const requirements = path.join(BACKEND_DIR, "requirements.txt");
	const stampFile = path.join(VENV_DIR, ".dev-setup-hash");

	if (readStamp(stampFile) === fileHash(requirements)) {
		step("Python packages", "up to date");
		return;
	}

	announce(
		"Installing backend packages into .venv (the first run downloads PyTorch and can take several minutes)",
	);
	const installed = run(VENV_PYTHON, [
		"-m",
		"pip",
		"install",
		"--disable-pip-version-check",
		"-r",
		requirements,
	]);
	if (!installed) {
		throw new SetupError("pip install failed. See the output above.");
	}
	writeFileSync(stampFile, fileHash(requirements));
	console.log();
	step("Python packages", "installed");
}

function ensureEnvFiles() {
	const created = [];
	for (const dir of [BACKEND_DIR, FRONTEND_DIR]) {
		const target = path.join(dir, ".env");
		const example = path.join(dir, ".env.example");
		if (!existsSync(target) && existsSync(example)) {
			copyFileSync(example, target);
			created.push(path.relative(ROOT, target));
		}
	}
	step(
		"Environment files",
		created.length ? `created ${created.join(", ")}` : "present",
	);
}

function checkModelWeights() {
	const envFile = path.join(BACKEND_DIR, ".env");
	const configured = existsSync(envFile)
		? readFileSync(envFile, "utf8").match(
				/^\s*MODEL_PATH\s*=\s*(.+?)\s*$/m,
			)?.[1]
		: null;
	const weights = path.resolve(
		BACKEND_DIR,
		configured || "Trained Weights/best.pt",
	);

	if (existsSync(weights)) {
		step("Model weights", path.relative(ROOT, weights));
		return null;
	}
	step("Model weights", "not found", false);
	return `No model weights at ${path.relative(ROOT, weights)}. The app still starts; upload a .pt file from the Analyse page, or place best.pt there and restart.`;
}

// Returns a list of non-fatal warnings to show once the app is running.
export function runSetup() {
	console.log(style.bold("  Setup"));
	checkNode();
	ensureFrontendPackages();
	ensureVenv();
	ensurePythonPackages();
	ensureEnvFiles();
	const warnings = [checkModelWeights()].filter(Boolean);
	console.log();
	return warnings;
}
