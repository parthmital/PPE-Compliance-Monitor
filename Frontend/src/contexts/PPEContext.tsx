import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";
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
	getVideoJobStatus,
	fetchSessionState,
	saveSessionState,
	clearSessionState,
} from "@/lib";
import type {
	AppConfig,
	SessionMetrics,
	Incident,
	DetectionResponse,
	VideoProgressState,
	VideoJobStatus,
	SessionState,
	Detection,
} from "@/lib";

// STORAGE: All state is instantly persisted to the backend data folder via API
// Every state change is immediately saved - no periodic/batch saving

interface PPEContextValue {
	// State
	config: AppConfig;
	metrics: SessionMetrics;
	incidents: Incident[];
	imageDimensions: { width: number; height: number } | null;
	isDarkMode: boolean;
	sessionStart: Date;
	isLoading: boolean;

	// Video Processing State (persisted)
	videoProcessing: boolean;
	videoProgress: number;
	videoFramesProcessed: number;
	videoTotalFrames: number;
	videoAlertsFound: number;

	// Detection Page State (persisted)
	detectionMediaType: "image" | "video" | "none";
	detectionDetections: Detection[];
	detectionImageFileName: string | null;
	detectionVideoFileName: string | null;
	detectionIsImageProcessing: boolean;

	// Actions
	setConfig: (partial: Partial<AppConfig>) => Promise<void>;
	uploadModel: (file: File) => Promise<boolean>;
	uploadImage: (file: File) => Promise<DetectionResponse | null>;
	uploadVideo: (
		file: File,
	) => Promise<{ frames_processed: number; alerts_count: number } | null>;
	refreshData: () => Promise<void>;
	clearAllIncidents: () => Promise<void>;
	toggleDarkMode: () => void;
	setVideoProcessing: (processing: boolean) => void;
	setVideoProgress: (progress: VideoProgressState) => void;

	// Detection page actions
	setDetectionState: (
		state: Partial<{
			mediaType: "image" | "video" | "none";
			detections: Detection[];
			imageFileName: string | null;
			videoFileName: string | null;
			isImageProcessing: boolean;
		}>,
	) => void;
	clearDetectionState: () => void;

	// Session state persistence
	loadSession: () => Promise<void>;
	saveSession: () => Promise<void>;
	clearSession: () => Promise<void>;
}

const defaultConfig: AppConfig = {
	confidence_threshold: 0.4,
	nms_iou_threshold: 0.45,
	model_loaded: false,
	model_name: "best.pt",
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

const defaultSessionState: SessionState = {
	config: {
		confidence_threshold: 0.4,
		nms_iou_threshold: 0.45,
		is_dark_mode: true,
	},
	video_progress: {
		processing: false,
		progress: 0,
		frames_processed: 0,
		total_frames: 0,
		alerts_found: 0,
		video_filename: null,
		job_id: null,
	},
	detection_page: {
		media_type: "none",
		detections: [],
		image_filename: null,
		video_filename: null,
		is_image_processing: false,
	},
};

const PPEContext = createContext<PPEContextValue | null>(null);

export function PPEProvider({ children }: { children: React.ReactNode }) {
	// State - all persisted instantly to backend data folder via useEffect
	const [config, setConfigState] = useState<AppConfig>(defaultConfig);
	const [metrics, setMetricsState] = useState<SessionMetrics>(defaultMetrics);
	const [incidents, setIncidents] = useState<Incident[]>([]);
	const [imageDimensions, setImageDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
	const [isLoading, setIsLoading] = useState(false);
	const [sessionStart] = useState(() => new Date());

	// Video Processing State - using useState with backend persistence
	const [videoProgressState, setVideoProgressState] = useState<{
		processing: boolean;
		progress: number;
		framesProcessed: number;
		totalFrames: number;
		alertsFound: number;
		jobId: string | null;
		videoFileName: string | null;
		videoFileType: string | null;
	}>({
		processing: false,
		progress: 0,
		framesProcessed: 0,
		totalFrames: 0,
		alertsFound: 0,
		jobId: null,
		videoFileName: null,
		videoFileType: null,
	});

	// Detection Page State - using useState with backend persistence
	const [detectionMediaType, setDetectionMediaType] = useState<
		"image" | "video" | "none"
	>("none");
	const [detectionDetections, setDetectionDetections] = useState<Detection[]>(
		[],
	);
	const [detectionImageFileName, setDetectionImageFileName] = useState<
		string | null
	>(null);
	const [detectionVideoFileName, setDetectionVideoFileName] = useState<
		string | null
	>(null);
	const [detectionIsImageProcessing, setDetectionIsImageProcessing] =
		useState(false);

	// Video job polling refs
	const jobPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const currentJobIdRef = useRef<string | null>(null);

	// Apply dark mode
	useEffect(() => {
		document.documentElement.classList.toggle("dark", isDarkMode);
	}, [isDarkMode]);

	// Fetch all data from backend
	const refreshData = useCallback(async () => {
		try {
			const [configData, metricsData, incidentsData] = await Promise.all([
				fetchConfig().catch(() => null),
				fetchMetrics().catch(() => null),
				fetchIncidents().catch(() => []),
			]);

			if (configData) setConfigState(configData);
			if (metricsData) setMetricsState(metricsData);
			setIncidents(incidentsData);
		} catch (error) {
			console.error("Failed to refresh data:", error);
		}
	}, []);

	// Update config with backend sync
	const setConfig = useCallback(
		async (partial: Partial<AppConfig>) => {
			setConfigState((prev) => ({ ...prev, ...partial }));

			// Sync thresholds with backend
			if (
				partial.confidence_threshold !== undefined ||
				partial.nms_iou_threshold !== undefined
			) {
				const currentConf =
					partial.confidence_threshold ?? config.confidence_threshold;
				const currentIou =
					partial.nms_iou_threshold ?? config.nms_iou_threshold;
				try {
					await updateThresholds(currentConf, currentIou);
				} catch (error) {
					toast.error("Failed to update thresholds");
				}
			}
		},
		[config.confidence_threshold, config.nms_iou_threshold],
	);

	// Upload model weights
	const uploadModel = useCallback(async (file: File): Promise<boolean> => {
		setIsLoading(true);
		try {
			const result = await reloadModel(file);
			if (result.success) {
				setConfigState((prev) => ({
					...prev,
					model_loaded: true,
					model_name: result.model_name,
				}));
				toast.success(`Model loaded: ${result.model_name}`);
				return true;
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to upload model";
			toast.error(message);
		} finally {
			setIsLoading(false);
		}
		return false;
	}, []);

	// Upload image for detection
	const uploadImage = useCallback(
		async (file: File): Promise<DetectionResponse | null> => {
			setIsLoading(true);
			try {
				const result = await detectImage(file);
				setImageDimensions({
					width: result.image_width,
					height: result.image_height,
				});
				await refreshData();
				return result;
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to process image";
				toast.error(message);
				return null;
			} finally {
				setIsLoading(false);
			}
		},
		[refreshData],
	);

	// Clear all incidents
	const clearAllIncidents = useCallback(async () => {
		try {
			await clearIncidents();
			setIncidents([]);
			await refreshData(); // Refresh metrics after clearing
			toast.success("All incidents cleared");
		} catch (error) {
			toast.error("Failed to clear incidents");
		}
	}, [refreshData]);

	// Toggle dark mode
	const toggleDarkMode = useCallback(() => {
		setIsDarkMode((prev) => !prev);
	}, []);

	// Session persistence functions
	const loadSession = useCallback(async () => {
		try {
			const sessionState = await fetchSessionState();
			if (sessionState.config) {
				setConfigState((prev) => ({
					...prev,
					confidence_threshold: sessionState.config.confidence_threshold,
					nms_iou_threshold: sessionState.config.nms_iou_threshold,
				}));
				setIsDarkMode(sessionState.config.is_dark_mode);
			}
			if (sessionState.video_progress) {
				const jobId = sessionState.video_progress.job_id;
				let isProcessing = sessionState.video_progress.processing;
				let progress = sessionState.video_progress.progress;
				let framesProcessed = sessionState.video_progress.frames_processed;
				let totalFrames = sessionState.video_progress.total_frames;
				let alertsFound = sessionState.video_progress.alerts_found;

				// If session says processing, verify job status with backend
				if (isProcessing && jobId) {
					try {
						const jobStatus = await getVideoJobStatus(jobId);
						if (jobStatus.status === "completed") {
							isProcessing = false;
							progress = 100;
							framesProcessed = jobStatus.frames_processed;
							alertsFound = jobStatus.alerts_found;
						} else if (jobStatus.status === "failed") {
							isProcessing = false;
							progress = 0;
						} else if (
							jobStatus.status === "processing" ||
							jobStatus.status === "pending"
						) {
							// Job is actually still running, use latest data
							progress = jobStatus.progress_percent;
							framesProcessed = jobStatus.frames_processed;
							totalFrames = jobStatus.total_frames;
							alertsFound = jobStatus.alerts_found;
						}
					} catch {
						// If job status check fails, assume job is done to avoid stuck state
						isProcessing = false;
					}
				}

				setVideoProgressState({
					processing: isProcessing,
					progress,
					framesProcessed,
					totalFrames,
					alertsFound,
					jobId,
					videoFileName: sessionState.video_progress.video_filename,
					videoFileType: null,
				});
			}
			if (sessionState.detection_page) {
				setDetectionMediaType(sessionState.detection_page.media_type);
				setDetectionDetections(sessionState.detection_page.detections);
				setDetectionImageFileName(sessionState.detection_page.image_filename);
				setDetectionVideoFileName(sessionState.detection_page.video_filename);
				setDetectionIsImageProcessing(
					sessionState.detection_page.is_image_processing,
				);
			}
		} catch (error) {
			console.error("Failed to load session:", error);
		}
	}, []);

	const saveSession = useCallback(async () => {
		try {
			const sessionState: SessionState = {
				config: {
					confidence_threshold: config.confidence_threshold,
					nms_iou_threshold: config.nms_iou_threshold,
					is_dark_mode: isDarkMode,
				},
				video_progress: {
					processing: videoProgressState.processing,
					progress: videoProgressState.progress,
					frames_processed: videoProgressState.framesProcessed,
					total_frames: videoProgressState.totalFrames,
					alerts_found: videoProgressState.alertsFound,
					video_filename: videoProgressState.videoFileName,
					job_id: videoProgressState.jobId,
				},
				detection_page: {
					media_type: detectionMediaType,
					detections: detectionDetections,
					image_filename: detectionImageFileName,
					video_filename: detectionVideoFileName,
					is_image_processing: detectionIsImageProcessing,
				},
			};
			await saveSessionState(sessionState);
		} catch (error) {
			console.error("Failed to save session:", error);
		}
	}, [
		config,
		isDarkMode,
		videoProgressState,
		detectionMediaType,
		detectionDetections,
		detectionImageFileName,
		detectionVideoFileName,
		detectionIsImageProcessing,
	]);

	const clearSession = useCallback(async () => {
		try {
			await clearSessionState();
			setConfigState(defaultConfig);
			setIsDarkMode(true);
			setVideoProgressState({
				processing: false,
				progress: 0,
				framesProcessed: 0,
				totalFrames: 0,
				alertsFound: 0,
				jobId: null,
				videoFileName: null,
				videoFileType: null,
			});
			setDetectionMediaType("none");
			setDetectionDetections([]);
			setDetectionImageFileName(null);
			setDetectionVideoFileName(null);
			setDetectionIsImageProcessing(false);
		} catch (error) {
			console.error("Failed to clear session:", error);
		}
	}, []);

	// Initial data load
	useEffect(() => {
		refreshData();
		// Load session state from backend on mount
		loadSession();
		const interval = setInterval(refreshData, 2000);
		return () => clearInterval(interval);
	}, [refreshData, loadSession]);

	// Instant save session state whenever relevant state changes
	useEffect(() => {
		saveSession();
	}, [
		config.confidence_threshold,
		config.nms_iou_threshold,
		isDarkMode,
		videoProgressState.processing,
		videoProgressState.progress,
		videoProgressState.framesProcessed,
		videoProgressState.totalFrames,
		videoProgressState.alertsFound,
		videoProgressState.jobId,
		videoProgressState.videoFileName,
		detectionMediaType,
		detectionDetections,
		detectionImageFileName,
		detectionVideoFileName,
		detectionIsImageProcessing,
		saveSession,
	]);

	// Video processing state setters
	const setVideoProcessingState = useCallback(
		(processing: boolean) => {
			setVideoProgressState((prev) => ({ ...prev, processing }));
		},
		[setVideoProgressState],
	);

	const setVideoProgress = useCallback(
		(progress: VideoProgressState) => {
			setVideoProgressState((prev) => ({
				...prev,
				processing: progress.processing,
				progress: progress.progress,
				framesProcessed: progress.framesProcessed,
				totalFrames: progress.totalFrames,
				alertsFound: progress.alertsFound,
			}));
		},
		[setVideoProgressState],
	);

	// Detection state management functions
	const setDetectionState = useCallback(
		(
			state: Partial<{
				mediaType: "image" | "video" | "none";
				detections: Detection[];
				imageFileName: string | null;
				videoFileName: string | null;
				isImageProcessing: boolean;
			}>,
		) => {
			if (state.mediaType !== undefined) setDetectionMediaType(state.mediaType);
			if (state.detections !== undefined)
				setDetectionDetections(state.detections);
			if (state.imageFileName !== undefined)
				setDetectionImageFileName(state.imageFileName);
			if (state.videoFileName !== undefined)
				setDetectionVideoFileName(state.videoFileName);
			if (state.isImageProcessing !== undefined)
				setDetectionIsImageProcessing(state.isImageProcessing);
		},
		[],
	);

	const clearDetectionState = useCallback(() => {
		setDetectionMediaType("none");
		setDetectionDetections([]);
		setDetectionImageFileName(null);
		setDetectionVideoFileName(null);
		setDetectionIsImageProcessing(false);
	}, []);

	// Upload video for detection (async with polling) - defined after setters
	const uploadVideo = useCallback(
		async (
			file: File,
			onProgress?: (state: VideoProgressState) => void,
		): Promise<{ frames_processed: number; alerts_count: number } | null> => {
			setIsLoading(true);
			setVideoProcessingState(true);

			try {
				// Start video processing job
				const startResult = await startVideoProcessing(file);
				const jobId = startResult.job_id;
				currentJobIdRef.current = jobId;

				// Set initial progress
				const initialState: VideoProgressState = {
					processing: true,
					progress: 5,
					framesProcessed: 0,
					totalFrames: startResult.estimated_frames,
					alertsFound: 0,
				};
				setVideoProgress(initialState);
				onProgress?.(initialState);

				// Poll for job status
				return new Promise((resolve, reject) => {
					const pollInterval = setInterval(async () => {
						try {
							const jobStatus = await getVideoJobStatus(jobId);

							// Update progress
							const progressState: VideoProgressState = {
								processing:
									jobStatus.status === "processing" ||
									jobStatus.status === "pending",
								progress: jobStatus.progress_percent,
								framesProcessed: jobStatus.frames_processed,
								totalFrames: jobStatus.total_frames,
								alertsFound: jobStatus.alerts_found,
							};
							setVideoProgress(progressState);
							onProgress?.(progressState);

							// Check if job is complete
							if (jobStatus.status === "completed") {
								clearInterval(pollInterval);
								jobPollIntervalRef.current = null;
								currentJobIdRef.current = null;
								setVideoProcessingState(false);
								await refreshData();
								toast.success("Video processing complete");
								resolve({
									frames_processed: jobStatus.frames_processed,
									alerts_count: jobStatus.alerts_found,
								});
							} else if (jobStatus.status === "failed") {
								clearInterval(pollInterval);
								jobPollIntervalRef.current = null;
								currentJobIdRef.current = null;
								setVideoProcessingState(false);
								reject(
									new Error(
										jobStatus.error_message || "Video processing failed",
									),
								);
							}
						} catch (error) {
							// Continue polling on error, but log it
							console.error("Error polling job status:", error);
						}
					}, 2000); // Poll every 2 seconds

					jobPollIntervalRef.current = pollInterval;

					// Timeout after 30 minutes
					setTimeout(
						() => {
							if (jobPollIntervalRef.current) {
								clearInterval(jobPollIntervalRef.current);
								jobPollIntervalRef.current = null;
								setVideoProcessingState(false);
								reject(new Error("Video processing timed out"));
							}
						},
						30 * 60 * 1000,
					);
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to process video";
				toast.error(message);
				setVideoProcessingState(false);
				return null;
			} finally {
				setIsLoading(false);
			}
		},
		[refreshData, setVideoProcessingState, setVideoProgress],
	);

	// Memoize context value
	const value = useMemo<PPEContextValue>(
		() => ({
			config,
			metrics,
			incidents,
			imageDimensions,
			isDarkMode,
			sessionStart,
			isLoading,
			videoProcessing: videoProgressState.processing,
			videoProgress: videoProgressState.progress,
			videoFramesProcessed: videoProgressState.framesProcessed,
			videoTotalFrames: videoProgressState.totalFrames,
			videoAlertsFound: videoProgressState.alertsFound,
			detectionMediaType,
			detectionDetections,
			detectionImageFileName,
			detectionVideoFileName,
			detectionIsImageProcessing,
			setConfig,
			uploadModel,
			uploadImage,
			uploadVideo,
			refreshData,
			clearAllIncidents,
			toggleDarkMode,
			setVideoProcessing: setVideoProcessingState,
			setVideoProgress,
			setDetectionState,
			clearDetectionState,
			loadSession,
			saveSession,
			clearSession,
		}),
		[
			config,
			metrics,
			incidents,
			imageDimensions,
			isDarkMode,
			sessionStart,
			isLoading,
			videoProgressState,
			detectionMediaType,
			detectionDetections,
			detectionImageFileName,
			detectionVideoFileName,
			detectionIsImageProcessing,
			setConfig,
			uploadModel,
			uploadImage,
			uploadVideo,
			refreshData,
			clearAllIncidents,
			toggleDarkMode,
			setVideoProcessingState,
			setVideoProgress,
			setDetectionState,
			clearDetectionState,
			loadSession,
			saveSession,
			clearSession,
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
