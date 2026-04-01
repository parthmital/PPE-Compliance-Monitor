// API layer exports
export { API_BASE, ApiError, apiFetch, apiPost, apiDelete } from "./api";
export {
	detectImage,
	detectVideo,
	fetchIncidents,
	clearIncidents,
	getIncidentImageUrl,
} from "./detection-api";
export { fetchConfig, updateThresholds, reloadModel } from "./config-api";
export { fetchMetrics } from "./metrics-api";
export {
	formatClassName,
	PPE_CLASSES,
	type Detection,
	type Incident,
	type SessionMetrics,
	type AppConfig,
	type DetectionResponse,
} from "./ppe-types";
