import type { Incident } from "@/lib/ppe-types";

// Uploads are stored as "upload_<date>_<time>_<micro>_<original name>", and
// images also get ".jpg" appended. Recover the name the user chose.
export function originalFileName(stored?: string): string | null {
	if (!stored) return null;
	const name = stored.replace(/^upload_\d{8}_\d{6}_\d+_/, "");
	return /\.[a-z0-9]+\.jpg$/i.test(name) ? name.slice(0, -4) : name;
}

export function incidentSource(incident: Incident): {
	kind: string;
	file: string | null;
} {
	if (incident.is_video) {
		return {
			kind:
				incident.frame_number != null
					? `Video, frame ${incident.frame_number.toLocaleString("en-IN")}`
					: "Video",
			file: originalFileName(incident.video_filename),
		};
	}
	return { kind: "Photo", file: originalFileName(incident.source_filename) };
}

function csvCell(value: unknown): string {
	return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function exportIncidentsToCSV(incidents: Incident[]): void {
	const header = [
		"ID",
		"Timestamp",
		"Missing PPE",
		"Frame Number",
		"Image Path",
	];
	const rows = incidents.map((inc) =>
		[
			inc.id,
			inc.timestamp,
			inc.missing_ppe.join("; "),
			inc.frame_number ?? "",
			inc.image_path ?? "",
		]
			.map(csvCell)
			.join(","),
	);
	const blob = new Blob([[header.join(","), ...rows].join("\n")], {
		type: "text/csv",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `ppe_incidents_${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}
