import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import {
	fetchConfig,
	updateThresholds,
	reloadModel,
	fetchMetrics,
	fetchIncidents,
	clearIncidents,
	detectImage,
	startVideoProcessing,
	fetchSessionState,
	saveSessionState,
	waitForVideoJob,
} from "@/lib";
import type {
	AppConfig,
	SessionMetrics,
	Incident,
	DetectionResponse,
	VideoProgressState,
	Detection,
} from "@/lib";
import {
	detectionFromSession,
	initialDetectionState,
	initialVideoState,
	toSessionState,
	videoFromSession,
	type DetectionState,
	type MediaKind,
	type VideoState,
} from "./session-state";

// UI state is saved to the backend data folder whenever it changes.

export type ConnectionState = "connecting" | "online" | "offline";

const REFRESH_INTERVAL_MS = 2000;

interface PPEContextValue {
	connection: ConnectionState;
	config: AppConfig;
	metrics: SessionMetrics;
	incidents: Incident[];
	imageDimensions: { width: number; height: number } | null;
	isDarkMode: boolean;

	videoProcessing: boolean;
	videoProgress: number;
	videoFramesProcessed: number;
	videoTotalFrames: number;
	videoAlertsFound: number;

	detectionMediaType: MediaKind;
	detectionDetections: Detection[];
	detectionImageFileName: string | null;
	detectionIsImageProcessing: boolean;

	setConfig: (partial: Partial<AppConfig>) => Promise<void>;
	uploadModel: (file: File) => Promise<boolean>;
	uploadImage: (file: File) => Promise<DetectionResponse | null>;
	uploadVideo: (file: File) => Promise<void>;
	clearAllIncidents: () => Promise<void>;
	toggleDarkMode: () => void;
	setVideoProcessing: (processing: boolean) => void;
	setDetectionState: (state: Partial<DetectionState>) => void;
	clearDetectionState: () => void;
}

const defaultConfig: AppConfig = {
	confidence_threshold: 0.4,
	nms_iou_threshold: 0.45,
	model_loaded: false,
	model_name: "best.pt",
	temporal_window: 5,
};

const defaultMetrics: SessionMetrics = {
	safety_score: 0,
	detection_accuracy: 0,
	alerts_per_hour: 0,
	false_alarm_rate: 0,
	frames_processed: 0,
	violation_frames: 0,
	confirmed_alerts: 0,
	persons_detected: 0,
};

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

const PPEContext = createContext<PPEContextValue | null>(null);

export function PPEProvider({ children }: { children: React.ReactNode }) {
	const [connection, setConnection] = useState<ConnectionState>("connecting");
	const [config, setConfigState] = useState<AppConfig>(defaultConfig);
	const [metrics, setMetrics] = useState<SessionMetrics>(defaultMetrics);
	const [incidents, setIncidents] = useState<Incident[]>([]);
	const [imageDimensions, setImageDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
	const [video, setVideo] = useState<VideoState>(initialVideoState);
	const [detection, setDetection] = useState<DetectionState>(
		initialDetectionState,
	);
	// Saving waits until the saved session has been loaded, so defaults
	// never overwrite it.
	const hydrated = useRef(false);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", isDarkMode);
	}, [isDarkMode]);

	const refreshData = useCallback(async () => {
		const [configData, metricsData, incidentsData] = await Promise.all([
			fetchConfig().catch(() => null),
			fetchMetrics().catch(() => null),
			fetchIncidents().catch(() => null),
		]);
		setConnection(configData ? "online" : "offline");
		if (configData) setConfigState(configData);
		if (metricsData) setMetrics(metricsData);
		if (incidentsData) setIncidents(incidentsData);
	}, []);

	const setConfig = useCallback(
		async (partial: Partial<AppConfig>) => {
			setConfigState((prev) => ({ ...prev, ...partial }));
			if (
				partial.confidence_threshold === undefined &&
				partial.nms_iou_threshold === undefined
			)
				return;
			try {
				await updateThresholds(
					partial.confidence_threshold ?? config.confidence_threshold,
					partial.nms_iou_threshold ?? config.nms_iou_threshold,
				);
			} catch {
				toast.error("Failed to update thresholds");
			}
		},
		[config.confidence_threshold, config.nms_iou_threshold],
	);

	const uploadModel = useCallback(async (file: File): Promise<boolean> => {
		try {
			const result = await reloadModel(file);
			setConfigState((prev) => ({
				...prev,
				model_loaded: result.model_loaded,
				model_name: result.model_name,
			}));
			toast.success(`Model loaded: ${result.model_name}`);
			return true;
		} catch (error) {
			toast.error(errorMessage(error, "Failed to upload model"));
			return false;
		}
	}, []);

	const uploadImage = useCallback(
		async (file: File): Promise<DetectionResponse | null> => {
			try {
				const result = await detectImage(file);
				setImageDimensions({
					width: result.image_width,
					height: result.image_height,
				});
				await refreshData();
				return result;
			} catch (error) {
				toast.error(errorMessage(error, "Failed to process image"));
				return null;
			}
		},
		[refreshData],
	);

	const applyVideoProgress = useCallback((progress: VideoProgressState) => {
		setVideo((prev) => ({ ...prev, ...progress }));
	}, []);

	// Follows a running job to completion, then refreshes dashboard data.
	const followVideoJob = useCallback(
		async (jobId: string) => {
			try {
				await waitForVideoJob(jobId, applyVideoProgress);
				toast.success("Video processing complete");
			} catch (error) {
				toast.error(errorMessage(error, "Video processing failed"));
			} finally {
				setVideo((prev) => ({ ...prev, processing: false }));
				await refreshData();
			}
		},
		[applyVideoProgress, refreshData],
	);

	const uploadVideo = useCallback(
		async (file: File) => {
			setVideo({ ...initialVideoState, processing: true, progress: 5 });
			try {
				const job = await startVideoProcessing(file);
				setVideo((prev) => ({
					...prev,
					jobId: job.job_id,
					videoFileName: file.name,
					totalFrames: job.estimated_frames,
				}));
				await followVideoJob(job.job_id);
			} catch (error) {
				toast.error(errorMessage(error, "Failed to process video"));
				setVideo((prev) => ({ ...prev, processing: false }));
			}
		},
		[followVideoJob],
	);

	const clearAllIncidents = useCallback(async () => {
		try {
			await clearIncidents();
			setIncidents([]);
			await refreshData();
			toast.success("All incidents cleared");
		} catch {
			toast.error("Failed to clear incidents");
		}
	}, [refreshData]);

	const toggleDarkMode = useCallback(() => {
		// Cross-fade the whole page instead of snapping every colour at once.
		const apply = () =>
			flushSync(() => {
				setIsDarkMode((prev) => {
					document.documentElement.classList.toggle("dark", !prev);
					return !prev;
				});
			});
		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (!document.startViewTransition || reduceMotion) apply();
		else document.startViewTransition(apply);
	}, []);

	const loadSession = useCallback(async () => {
		try {
			const session = await fetchSessionState();
			if (session.config) {
				setConfigState((prev) => ({
					...prev,
					confidence_threshold: session.config.confidence_threshold,
					nms_iou_threshold: session.config.nms_iou_threshold,
				}));
				setIsDarkMode(session.config.is_dark_mode);
			}
			if (session.detection_page)
				setDetection(detectionFromSession(session.detection_page));
			if (session.video_progress) {
				const saved = videoFromSession(session.video_progress);
				setVideo(saved);
				// Resume tracking a job that was running before the reload.
				if (saved.processing && saved.jobId) followVideoJob(saved.jobId);
			}
		} catch (error) {
			console.error("Failed to load session:", error);
		} finally {
			hydrated.current = true;
		}
	}, [followVideoJob]);

	useEffect(() => {
		refreshData();
		loadSession();
		const interval = setInterval(refreshData, REFRESH_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [refreshData, loadSession]);

	useEffect(() => {
		if (!hydrated.current) return;
		saveSessionState(
			toSessionState({
				confidence: config.confidence_threshold,
				iou: config.nms_iou_threshold,
				isDarkMode,
				video,
				detection,
			}),
		).catch((error) => console.error("Failed to save session:", error));
	}, [
		config.confidence_threshold,
		config.nms_iou_threshold,
		isDarkMode,
		video,
		detection,
	]);

	const setVideoProcessing = useCallback((processing: boolean) => {
		setVideo((prev) => ({ ...prev, processing }));
	}, []);

	const setDetectionState = useCallback((state: Partial<DetectionState>) => {
		setDetection((prev) => ({ ...prev, ...state }));
	}, []);

	const clearDetectionState = useCallback(() => {
		setDetection(initialDetectionState);
	}, []);

	const value = useMemo<PPEContextValue>(
		() => ({
			connection,
			config,
			metrics,
			incidents,
			imageDimensions,
			isDarkMode,
			videoProcessing: video.processing,
			videoProgress: video.progress,
			videoFramesProcessed: video.framesProcessed,
			videoTotalFrames: video.totalFrames,
			videoAlertsFound: video.alertsFound,
			detectionMediaType: detection.mediaType,
			detectionDetections: detection.detections,
			detectionImageFileName: detection.imageFileName,
			detectionIsImageProcessing: detection.isImageProcessing,
			setConfig,
			uploadModel,
			uploadImage,
			uploadVideo,
			clearAllIncidents,
			toggleDarkMode,
			setVideoProcessing,
			setDetectionState,
			clearDetectionState,
		}),
		[
			connection,
			config,
			metrics,
			incidents,
			imageDimensions,
			isDarkMode,
			video,
			detection,
			setConfig,
			uploadModel,
			uploadImage,
			uploadVideo,
			clearAllIncidents,
			toggleDarkMode,
			setVideoProcessing,
			setDetectionState,
			clearDetectionState,
		],
	);

	return <PPEContext.Provider value={value}>{children}</PPEContext.Provider>;
}

export function usePPE(): PPEContextValue {
	const context = useContext(PPEContext);
	if (!context) {
		throw new Error("usePPE must be used within a PPEProvider");
	}
	return context;
}
