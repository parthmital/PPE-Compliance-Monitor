// API layer exports
export { API_BASE, ApiError, apiFetch, apiPost, apiDelete } from "./api";
export {
	detectImage,
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
} from "./session-api";
export { waitForVideoJob } from "./video-job";
export {
	formatClassName,
	getPPEClass,
	PPE_CLASSES,
	type PPEClass,
	type Detection,
	type Incident,
	type SessionMetrics,
	type AppConfig,
	type DetectionResponse,
	type VideoProgressState,
	type VideoJobStatus,
	type SessionState,
} from "./ppe-types";
export {
	parseTimestamp,
	formatTimestamp,
	formatClock,
	formatDuration,
	formatCount,
} from "./format";
