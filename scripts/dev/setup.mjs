// First-run setup for `npm run dev`. Every step is idempotent: it records a
// hash of the file it installed from and skips the work when nothing changed,
// so an interrupted install resumes on the next run.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
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
const PYTHON_STAMP = path.join(VENV_DIR, ".dev-setup-hash");
const INTERRUPT_SIGNALS = ["SIGINT", "SIGBREAK"];

export class SetupError extends Error {}

// Set when Ctrl+C reaches this console during setup. VS Code can send one on
// its own: its Python terminal auto-activation types Ctrl+C before running the
// activate command when it spots a new .venv.
let interrupted = false;
const onInterrupt = () => {
	interrupted = true;
};

function throwIfInterrupted() {
	if (!interrupted) return;
	throw new SetupError(
		"Setup was interrupted by Ctrl+C. Nothing is lost: run `npm run dev` again to resume. If you did not press Ctrl+C, VS Code sent it while auto-activating the new .venv; set `python-envs.terminal.autoActivationType` to `shellStartup` in your VS Code user settings to keep auto-activation without it.",
	);
}

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

// Asynchronous so the interrupt listener runs while the child is working.
async function run(file, args, options = {}) {
	throwIfInterrupted();
	const status = await new Promise((resolve, reject) => {
		const child = spawn(file, args, { stdio: "inherit", ...options });
		child.once("error", reject);
		child.once("close", resolve);
	});
	throwIfInterrupted();
	return status === 0;
}

// Run npm through the same npm CLI that invoked this script, so no shell is needed.
function npm(args, cwd) {
	const npmCli = process.env.npm_execpath;
	if (npmCli) return run(process.execPath, [npmCli, ...args], { cwd });
	return run(`npm ${args.join(" ")}`, [], { cwd, shell: true });
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

async function ensureFrontendPackages() {
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
	if (!(await npm(["install", "--no-audit", "--no-fund"], FRONTEND_DIR))) {
		throw new SetupError(
			"npm install failed in Frontend/. See the output above.",
		);
	}
	// npm may normalise the lockfile, so hash it after installing.
	writeFileSync(stampFile, fileHash(lockFile));
	console.log();
	step("Frontend packages", "installed");
}

// A .venv is usable when its interpreter runs and, until packages have been
// installed into it once, pip runs too (an interrupted `venv` can leave pip out).
function isVenvHealthy() {
	if (!pythonVersion(VENV_PYTHON, [])) return false;
	if (existsSync(PYTHON_STAMP)) return true;
	return spawnSync(VENV_PYTHON, ["-m", "pip", "--version"]).status === 0;
}

async function ensureVenv() {
	if (existsSync(VENV_DIR)) {
		if (isVenvHealthy()) {
			const version = pythonVersion(VENV_PYTHON, []);
			step("Python environment", `.venv (Python ${version.join(".")})`);
			return;
		}
		announce("Removing the incomplete .venv left by an earlier run");
		try {
			rmSync(VENV_DIR, { recursive: true, force: true, maxRetries: 5 });
		} catch (error) {
			throw new SetupError(
				`The virtual environment at ${path.relative(ROOT, VENV_DIR)} is broken and could not be removed (${error.code}). Close programs using it, delete the .venv folder and run \`npm run dev\` again.`,
			);
		}
	}

	const python = findSystemPython();
	announce(`Creating .venv with Python ${python.version.join(".")}`);
	if (!(await run(python.file, [...python.args, "-m", "venv", VENV_DIR]))) {
		throw new SetupError("Could not create the Python virtual environment.");
	}
	step(
		"Python environment",
		`.venv created (Python ${python.version.join(".")})`,
	);
}

async function ensurePythonPackages() {
	const requirements = path.join(BACKEND_DIR, "requirements.txt");

	if (readStamp(PYTHON_STAMP) === fileHash(requirements)) {
		step("Python packages", "up to date");
		return;
	}

	announce(
		"Installing backend packages into .venv (the first run downloads PyTorch and can take several minutes)",
	);
	const installed = await run(VENV_PYTHON, [
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
	writeFileSync(PYTHON_STAMP, fileHash(requirements));
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
		configured || "output/weights/best.pt",
	);

	if (existsSync(weights)) {
		step("Model weights", path.relative(ROOT, weights));
		return null;
	}
	step("Model weights", "not found", false);
	return `No model weights at ${path.relative(ROOT, weights)}. The app still starts; upload a .pt file from the Analyse page, or place best.pt there and restart.`;
}

// Resolves to a list of non-fatal warnings to show once the app is running.
export async function runSetup() {
	for (const signal of INTERRUPT_SIGNALS) process.on(signal, onInterrupt);
	try {
		console.log(style.bold("  Setup"));
		checkNode();
		await ensureFrontendPackages();
		await ensureVenv();
		await ensurePythonPackages();
		ensureEnvFiles();
		const warnings = [checkModelWeights()].filter(Boolean);
		console.log();
		return warnings;
	} finally {
		for (const signal of INTERRUPT_SIGNALS) process.off(signal, onInterrupt);
	}
}
