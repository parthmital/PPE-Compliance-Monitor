// Shared paths, service definitions and terminal styling for the dev launcher.

import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
);
export const BACKEND_DIR = path.join(ROOT, "Backend");
export const FRONTEND_DIR = path.join(ROOT, "Frontend");
export const VENV_DIR = path.join(ROOT, ".venv");
export const VENV_PYTHON =
	process.platform === "win32"
		? path.join(VENV_DIR, "Scripts", "python.exe")
		: path.join(VENV_DIR, "bin", "python");

export const SERVICES = {
	backend: {
		label: "Backend",
		detail: "FastAPI + Uvicorn",
		url: "http://localhost:8000/api",
		healthUrl: "http://127.0.0.1:8000/api/health",
		port: 8000,
		color: 36,
		command: () => ({
			file: VENV_PYTHON,
			args: ["-u", "api.py"],
			cwd: BACKEND_DIR,
			env: {
				PYTHONUNBUFFERED: "1",
				PYTHONIOENCODING: "utf-8",
				YOLO_VERBOSE: "False",
			},
		}),
	},
	frontend: {
		label: "Frontend",
		detail: "Vite dev server",
		url: "http://localhost:8080",
		healthUrl: "http://localhost:8080/",
		port: 8080,
		color: 35,
		command: () => ({
			file: process.execPath,
			args: [
				path.join(FRONTEND_DIR, "node_modules", "vite", "bin", "vite.js"),
				"--strictPort",
				"--clearScreen",
				"false",
			],
			cwd: FRONTEND_DIR,
			env: { FORCE_COLOR: "1" },
		}),
	},
};

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) =>
	useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text);

export const style = {
	bold: paint(1),
	dim: paint(2),
	red: paint(31),
	green: paint(32),
	yellow: paint(33),
	color: (code, text) => paint(code)(text),
	badge: (code, text) => paint(`1;30;${code + 10}`)(` ${text} `),
};
