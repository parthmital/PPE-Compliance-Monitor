import { apiDelete, apiFetch, apiPost } from "@/lib/api";
import type { SessionState } from "@/lib/ppe-types";

// UI session state persisted in the backend data folder.
export async function fetchSessionState(): Promise<SessionState> {
	const response = await apiFetch<{ state: SessionState }>("/session");
	return response.state;
}

export async function saveSessionState(state: SessionState): Promise<void> {
	await apiPost("/session", state);
}

export async function clearSessionState(): Promise<void> {
	await apiDelete("/session");
}
