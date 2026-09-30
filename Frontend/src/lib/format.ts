// Display formatting shared across pages.

const dateFormat = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});
const shortTimeFormat = new Intl.DateTimeFormat("en-GB", {
	hour: "2-digit",
	minute: "2-digit",
});

// Backend timestamps are local time in "YYYY-MM-DD HH:MM:SS" form.
export function parseTimestamp(value: string): Date | null {
	const date = new Date(value.replace(" ", "T"));
	return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimestamp(value: string): { date: string; time: string } {
	const date = parseTimestamp(value);
	if (!date) return { date: value, time: "" };
	return { date: dateFormat.format(date), time: timeFormat.format(date) };
}

export function formatClock(date: Date): string {
	return shortTimeFormat.format(date);
}

export function formatDuration(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds || 0));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatCount(value: number): string {
	return value.toLocaleString("en-IN");
}
