import { apiFetch, apiPost, apiDelete, ApiError } from "@/lib/api";
import type { DetectionResponse, Incident } from "@/lib/ppe-types";

// Detection API functions
export async function detectImage(file: File): Promise<DetectionResponse> {
	const formData = new FormData();
	formData.append("file", file);
	return apiPost<DetectionResponse>("/detect/image", formData);
}

export async function detectVideo(file: File): Promise<{
	frames_processed: number;
	alerts_count: number;
}> {
	const formData = new FormData();
	formData.append("file", file);
	return apiPost("/detect/video", formData);
}

// Incidents API functions
export async function fetchIncidents(): Promise<Incident[]> {
	const response = await apiFetch<{ incidents: Incident[] }>("/incidents");
	return response.incidents;
}

export async function clearIncidents(): Promise<void> {
	await apiDelete("/incidents/clear");
}

// Get full image URL for incident
export function getIncidentImageUrl(path?: string): string | null {
	if (!path) return null;
	if (path.startsWith("http")) return path;
	const baseUrl =
		import.meta.env.VITE_API_BASE_URL?.replace("/api", "") ||
		"http://localhost:8000";
	return `${baseUrl}${path}`;
}

export { ApiError };
