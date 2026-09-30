import { API_BASE, apiDelete, apiFetch, apiPost } from "@/lib/api";
import type {
	DetectionResponse,
	Incident,
	VideoJobStatus,
} from "@/lib/ppe-types";

function fileForm(file: File): FormData {
	const formData = new FormData();
	formData.append("file", file);
	return formData;
}

export async function detectImage(file: File): Promise<DetectionResponse> {
	return apiPost<DetectionResponse>("/detect/image", fileForm(file));
}

// Starts a background job; poll getVideoJobStatus for progress.
export async function startVideoProcessing(file: File): Promise<{
	job_id: string;
	status: string;
	message: string;
	estimated_frames: number;
}> {
	return apiPost("/detect/video", fileForm(file));
}

export async function getVideoJobStatus(
	jobId: string,
): Promise<VideoJobStatus> {
	return apiFetch<VideoJobStatus>(`/detect/video/${jobId}`);
}

export async function fetchIncidents(): Promise<Incident[]> {
	const response = await apiFetch<{ incidents: Incident[] }>("/incidents");
	return response.incidents;
}

export async function clearIncidents(): Promise<void> {
	await apiDelete("/incidents/clear");
}

// Incident image paths are server-absolute ("/api/incidents/images/...").
export function getIncidentImageUrl(path?: string): string | null {
	if (!path) return null;
	if (path.startsWith("http")) return path;
	return `${new URL(API_BASE).origin}${path}`;
}
