import { apiFetch, apiPost } from "@/lib/api";
import type { AppConfig } from "@/lib/ppe-types";

export async function fetchConfig(): Promise<AppConfig> {
	return apiFetch<AppConfig>("/config");
}

export async function updateThresholds(
	confidence: number,
	iou: number,
): Promise<void> {
	await apiPost(`/config/thresholds?conf=${confidence}&iou=${iou}`, undefined);
}

export async function reloadModel(file: File): Promise<{
	status: string;
	model_loaded: boolean;
	model_name: string;
}> {
	const formData = new FormData();
	formData.append("weights_file", file);
	return apiPost("/model/reload", formData);
}
