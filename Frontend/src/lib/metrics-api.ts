import { apiFetch } from "@/lib/api";
import type { SessionMetrics } from "@/lib/ppe-types";

// Metrics API functions
export async function fetchMetrics(): Promise<SessionMetrics> {
	const response = await apiFetch<{ metrics: SessionMetrics }>("/metrics");
	return response.metrics;
}
