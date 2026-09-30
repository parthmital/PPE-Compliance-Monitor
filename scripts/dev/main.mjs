// Entry point for `npm run dev` at the repository root.
//
// 1. Runs first-time setup (npm packages, Python .venv and packages, .env files),
//    skipping anything that is already up to date.
// 2. Opens one console window for backend logs and one for frontend logs.
// 3. Keeps this terminal as the controller: Ctrl+C here stops both services
//    and closes their windows.

import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SERVICES, style } from "./services.mjs";
import { runSetup, SetupError } from "./setup.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PIPE_PATH = `\\\\.\\pipe\\ppe-monitor-dev-${process.pid}`;
const CONNECT_TIMEOUT_MS = 15_000;
const BACKEND_READY_TIMEOUT_MS = 180_000;
const FRONTEND_READY_TIMEOUT_MS = 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Per-service link to its log window.
const links = Object.fromEntries(
	Object.keys(SERVICES).map((name) => [
		name,
		{ socket: null, exited: false, connected: null },
	]),
);
let stopping = false;

function fail(message) {
	console.error(`\n  ${style.red("✗")} ${message}\n`);
	process.exit(1);
}

function portOwner(port) {
	const netstat = spawnSync("netstat", ["-ano", "-p", "tcp"], {
		encoding: "utf8",
	});
	const line = netstat.stdout
		?.split(/\r?\n/)
		.find((row) => /LISTENING/.test(row) && row.includes(`:${port} `));
	const pid = line?.trim().split(/\s+/).pop();
	if (!pid) return "another process";
	const tasklist = spawnSync(
		"tasklist",
		["/fi", `PID eq ${pid}`, "/fo", "csv", "/nh"],
		{ encoding: "utf8" },
	);
	const image = tasklist.stdout?.split(",")[0]?.replace(/"/g, "").trim();
	return image ? `${image} (PID ${pid})` : `PID ${pid}`;
}

function isPortFree(port) {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.once("error", () => resolve(false));
		server.once("listening", () => server.close(() => resolve(true)));
		server.listen(port);
	});
}

async function ensurePortsFree() {
	for (const service of Object.values(SERVICES)) {
		if (!(await isPortFree(service.port))) {
			fail(
				`Port ${service.port} (${service.label}) is in use by ${portOwner(service.port)}. Stop it, then run \`npm run dev\` again.`,
			);
		}
	}
}

function handleRunnerMessage(name, message) {
	const link = links[name];
	if (message.type === "exit" && !stopping) {
		link.exited = true;
		console.log(
			`  ${style.red("✗")} ${SERVICES[name].label} stopped unexpectedly. Its log window stays open with the details. Press Ctrl+C to stop everything.`,
		);
	}
}

function startControlServer() {
	const server = net.createServer((socket) => {
		let name = null;
		let buffer = "";
		socket.on("data", (chunk) => {
			buffer += chunk.toString();
			let newline;
			while ((newline = buffer.indexOf("\n")) >= 0) {
				const message = JSON.parse(buffer.slice(0, newline));
				buffer = buffer.slice(newline + 1);
				if (message.type === "hello" && links[message.service]) {
					name = message.service;
					links[name].socket = socket;
					links[name].connected?.();
				} else if (name) {
					handleRunnerMessage(name, message);
				}
			}
		});
		socket.on("close", () => {
			if (!name || stopping) return;
			links[name].socket = null;
			console.log(
				`\n  ${style.yellow("!")} The ${SERVICES[name].label} logs window was closed. Stopping everything.`,
			);
			shutdown(1);
		});
		socket.on("error", () => {});
	});
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(PIPE_PATH, () => resolve(server));
	});
}

function openLogWindow(name) {
	const { label } = SERVICES[name];
	const runner = path.join(HERE, "log-window.mjs");
	const command = `start "PPE Monitor - ${label} logs" "${process.execPath}" "${runner}" ${name} ${PIPE_PATH}`;
	spawn("cmd.exe", ["/d", "/s", "/c", `"${command}"`], {
		windowsVerbatimArguments: true,
		stdio: "ignore",
	});

	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`The ${label} logs window did not start.`)),
			CONNECT_TIMEOUT_MS,
		);
		links[name].connected = () => {
			clearTimeout(timer);
			resolve();
		};
	});
}

// Polls a URL until it answers. Returns the parsed body, or null on timeout
// or when the service exits first.
async function waitUntilReady(name, timeoutMs) {
	const { healthUrl } = SERVICES[name];
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline && !links[name].exited && !stopping) {
		try {
			const response = await fetch(healthUrl, {
				signal: AbortSignal.timeout(2000),
			});
			if (response.ok) {
				const type = response.headers.get("content-type") || "";
				return type.includes("json") ? await response.json() : {};
			}
		} catch {
			// Not listening yet.
		}
		await sleep(1000);
	}
	return null;
}

async function reportReady(name, timeoutMs, describe) {
	const started = Date.now();
	const body = await waitUntilReady(name, timeoutMs);
	if (stopping) return false;
	const { label, url } = SERVICES[name];
	if (!body) {
		if (!links[name].exited) {
			console.log(
				`  ${style.yellow("!")} ${label.padEnd(9)} not answering yet. Check the ${label} logs window.`,
			);
		}
		return false;
	}
	const seconds = Math.round((Date.now() - started) / 1000);
	const note = describe?.(body);
	console.log(
		`  ${style.green("✓")} ${label.padEnd(9)} ${style.bold(url.padEnd(28))} ${style.dim(`ready in ${seconds}s${note ? `, ${note}` : ""}`)}`,
	);
	return true;
}

function openBrowser(url) {
	spawn("cmd.exe", ["/d", "/s", "/c", `"start "" "${url}""`], {
		windowsVerbatimArguments: true,
		stdio: "ignore",
	});
}

async function shutdown(code = 0) {
	if (stopping) return;
	stopping = true;
	console.log(`\n  Stopping backend and frontend…`);

	const closing = Object.values(links)
		.filter((link) => link.socket && !link.socket.destroyed)
		.map(
			(link) =>
				new Promise((resolve) => {
					link.socket.once("close", resolve);
					link.socket.write("stop\n");
				}),
		);
	await Promise.race([Promise.all(closing), sleep(5000)]);

	console.log(`  ${style.green("✓")} Stopped.\n`);
	process.exit(code);
}

async function main() {
	if (process.platform !== "win32") {
		fail(
			"`npm run dev` opens Windows console windows and currently supports Windows only. On other systems, run `python -u api.py` in Backend/ (inside .venv) and `npm run dev` in Frontend/.",
		);
	}

	console.log(
		`\n  ${style.badge(33, "PPE COMPLIANCE MONITOR")}  ${style.dim("development")}\n`,
	);

	let warnings;
	try {
		warnings = runSetup();
	} catch (error) {
		fail(error instanceof SetupError ? error.message : String(error));
	}

	await ensurePortsFree();

	for (const signal of ["SIGINT", "SIGHUP", "SIGBREAK", "SIGTERM"]) {
		process.on(signal, () => shutdown(0));
	}

	console.log(style.bold("  Services"));
	await startControlServer();
	try {
		await Promise.all(Object.keys(SERVICES).map(openLogWindow));
	} catch (error) {
		console.error(`  ${style.red("✗")} ${error.message}`);
		await shutdown(1);
	}

	const [backendReady, frontendReady] = await Promise.all([
		reportReady("backend", BACKEND_READY_TIMEOUT_MS, (health) =>
			health.model_loaded ? "model loaded" : style.yellow("no model loaded"),
		),
		reportReady("frontend", FRONTEND_READY_TIMEOUT_MS),
	]);
	if (stopping) return;

	for (const warning of warnings) {
		console.log(`\n  ${style.yellow("!")} ${warning}`);
	}
	if (frontendReady) {
		openBrowser(SERVICES.frontend.url);
		console.log(`\n  Opened ${SERVICES.frontend.url} in your browser.`);
	}
	if (!backendReady || !frontendReady) {
		console.log(
			`  ${style.yellow("!")} Not everything started. The log windows show why.`,
		);
	}
	console.log(style.dim("  Logs are in the Backend and Frontend windows."));
	console.log(`  Press ${style.bold("Ctrl+C")} here to stop everything.\n`);
}

main();
