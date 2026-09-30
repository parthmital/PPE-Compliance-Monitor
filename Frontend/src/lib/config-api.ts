import { apiFetch, apiPost, ApiError } from "@/lib/api";
import type { AppConfig } from "@/lib/ppe-types";

// Config API functions
export async function fetchConfig(): Promise<AppConfig> {
	return apiFetch<AppConfig>("/config");
}

export async function updateThresholds(
	confidence: number,
	iou: number,
): Promise<void> {
	await apiPost(`/config/thresholds?conf=${confidence}&iou=${iou}`, undefined);
}

// Model API functions
export async function reloadModel(file: File): Promise<{
	success: boolean;
	model_name: string;
	message?: string;
}> {
	const formData = new FormData();
	formData.append("weights_file", file);
	return apiPost("/model/reload", formData);
}

export { ApiError };
