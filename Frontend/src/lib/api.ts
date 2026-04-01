// Base API configuration and utilities
const API_BASE =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export { API_BASE };

// API Error class for typed error handling
export class ApiError extends Error {
	constructor(
		message: string,
		public status?: number,
		public data?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}

// Generic fetch wrapper with error handling
export async function apiFetch<T>(
	endpoint: string,
	options?: RequestInit,
): Promise<T> {
	const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
	const response = await fetch(url, options);

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new ApiError(
			errorData.detail || `API Error: ${response.statusText}`,
			response.status,
			errorData,
		);
	}

	return response.json();
}

// POST request helper
export function apiPost<T>(
	endpoint: string,
	data?: FormData | object,
	options?: RequestInit,
): Promise<T> {
	const isFormData = data instanceof FormData;

	return apiFetch<T>(endpoint, {
		method: "POST",
		body: isFormData ? data : data ? JSON.stringify(data) : undefined,
		headers: isFormData
			? options?.headers
			: {
					"Content-Type": "application/json",
					...options?.headers,
				},
		...options,
	});
}

// DELETE request helper
export function apiDelete<T>(endpoint: string): Promise<T> {
	return apiFetch<T>(endpoint, { method: "DELETE" });
}
