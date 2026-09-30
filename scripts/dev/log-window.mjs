// Runs inside a dedicated console window opened by main.mjs. It starts one
// service with this window as its terminal and stays linked to the controller
// over a named pipe: when the controller stops (or disappears), the service
// and this window are shut down too.
//
// Usage (spawned by main.mjs): node log-window.mjs <backend|frontend> <pipe path>

import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { SERVICES, style } from "./services.mjs";

const [name, pipePath] = process.argv.slice(2);
const service = SERVICES[name];
if (!service || !pipePath) {
	console.error("Usage: node log-window.mjs <backend|frontend> <pipe path>");
	process.exit(2);
}

process.title = `PPE Monitor - ${service.label} logs`;

let child = null;
let childRunning = false;

function banner() {
	const { color, label, detail, url } = service;
	console.log();
	console.log(
		`  ${style.badge(color, label.toUpperCase())}  ${style.bold(detail)}  ${style.dim(url)}`,
	);
	console.log(
		style.dim("  Stop the whole app with Ctrl+C in the main terminal."),
	);
	console.log(style.color(color, `  ${"─".repeat(64)}`));
	console.log();
}

function killChildTree() {
	if (!childRunning) return;
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
			stdio: "ignore",
		});
	} else {
		child.kill("SIGTERM");
	}
}

function shutdown() {
	killChildTree();
	process.exit(0);
}

// Ctrl+C in this window reaches the service directly; stay open to report it.
process.on("SIGINT", () => {});

const socket = net.connect(pipePath);
const send = (message) => {
	if (!socket.destroyed) socket.write(`${JSON.stringify(message)}\n`);
};

socket.on("connect", () => {
	banner();
	send({ type: "hello", service: name });

	const { file, args, cwd, env } = service.command();
	child = spawn(file, args, {
		cwd,
		env: { ...process.env, ...env },
		stdio: "inherit",
	});
	childRunning = true;

	child.on("error", (error) => {
		childRunning = false;
		console.error(
			style.red(`\n  Could not start ${service.label}: ${error.message}`),
		);
		send({ type: "exit", code: null });
	});

	child.on("exit", (code, signal) => {
		childRunning = false;
		const how = signal ? `signal ${signal}` : `code ${code}`;
		const text = `\n  ${service.label} stopped (${how}). This window stays open so the log above can be read.`;
		console.log(code === 0 ? style.yellow(text) : style.red(text));
		send({ type: "exit", code });
	});
});

socket.on("data", (data) => {
	if (data.toString().includes("stop")) shutdown();
});
socket.on("close", shutdown);
socket.on("error", () => {
	console.error(
		style.red("  Lost contact with the main terminal. Shutting down."),
	);
	shutdown();
});
