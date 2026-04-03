// API layer exports
export { API_BASE, ApiError, apiFetch, apiPost, apiDelete } from "./api";
export {
	detectImage,
	detectVideo,
	startVideoProcessing,
	getVideoJobStatus,
	fetchIncidents,
	clearIncidents,
	getIncidentImageUrl,
} from "./detection-api";
export { fetchConfig, updateThresholds, reloadModel } from "./config-api";
export { fetchMetrics } from "./metrics-api";
export {
	fetchSessionState,
	saveSessionState,
	clearSessionState,
} from "./detection-api";
export {
	formatClassName,
	PPE_CLASSES,
	type Detection,
	type Incident,
	type SessionMetrics,
	type AppConfig,
	type DetectionResponse,
	type VideoProgressState,
	type SavedDetectionState,
	type SavedVideoState,
	type VideoJobStatus,
	type SessionState,
} from "./ppe-types";
