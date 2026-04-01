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
} from "@/lib";
import type {
	AppConfig,
	SessionMetrics,
	Incident,
	DetectionResponse,
	VideoProgressState,
	VideoJobStatus,
} from "@/lib";

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

const PPEContext = createContext<PPEContextValue | null>(null);

export function PPEProvider({ children }: { children: React.ReactNode }) {
	// State
	const [config, setConfigState] = useState<AppConfig>(defaultConfig);
	const [metrics, setMetricsState] = useState<SessionMetrics>(defaultMetrics);
	const [incidents, setIncidents] = useState<Incident[]>([]);
	const [imageDimensions, setImageDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [isDarkMode, setIsDarkMode] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [sessionStart] = useState(() => new Date());

	// Video Processing State
	const [videoProcessing, setVideoProcessing] = useState(false);
	const [videoProgress, setVideoProgressState] = useState(0);
	const [videoFramesProcessed, setVideoFramesProcessed] = useState(0);
	const [videoTotalFrames, setVideoTotalFrames] = useState(0);
	const [videoAlertsFound, setVideoAlertsFound] = useState(0);

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

	// Initial data load and polling
	useEffect(() => {
		refreshData();
		const interval = setInterval(refreshData, 2000);
		return () => clearInterval(interval);
	}, [refreshData]);

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
			toast.success("All incidents cleared");
		} catch (error) {
			toast.error("Failed to clear incidents");
		}
	}, []);

	// Toggle dark mode
	const toggleDarkMode = useCallback(() => {
		setIsDarkMode((prev) => !prev);
	}, []);

	// Video processing state setters
	const setVideoProcessingState = useCallback((processing: boolean) => {
		setVideoProcessing(processing);
		// Persist to localStorage
		if (processing) {
			localStorage.setItem("ppe_video_processing", "true");
		} else {
			localStorage.removeItem("ppe_video_processing");
			localStorage.removeItem("ppe_video_file");
		}
	}, []);

	const setVideoProgress = useCallback((progress: VideoProgressState) => {
		setVideoProgressState(progress.progress);
		setVideoFramesProcessed(progress.framesProcessed);
		setVideoTotalFrames(progress.totalFrames);
		setVideoAlertsFound(progress.alertsFound);
		// Persist progress
		localStorage.setItem("ppe_video_progress", JSON.stringify(progress));
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

	// Restore video processing state on mount
	useEffect(() => {
		const saved = localStorage.getItem("ppe_video_processing");
		if (saved === "true") {
			const savedProgress = localStorage.getItem("ppe_video_progress");
			if (savedProgress) {
				try {
					const progress: VideoProgressState = JSON.parse(savedProgress);
					setVideoProcessing(true);
					setVideoProgressState(progress.progress);
					setVideoFramesProcessed(progress.framesProcessed);
					setVideoTotalFrames(progress.totalFrames);
					setVideoAlertsFound(progress.alertsFound);
				} catch {
					// Ignore parse errors
				}
			}
		}
	}, []);

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
			videoProcessing,
			videoProgress,
			videoFramesProcessed,
			videoTotalFrames,
			videoAlertsFound,
			setConfig,
			uploadModel,
			uploadImage,
			uploadVideo,
			refreshData,
			clearAllIncidents,
			toggleDarkMode,
			setVideoProcessing: setVideoProcessingState,
			setVideoProgress,
		}),
		[
			config,
			metrics,
			incidents,
			imageDimensions,
			isDarkMode,
			sessionStart,
			isLoading,
			videoProcessing,
			videoProgress,
			videoFramesProcessed,
			videoTotalFrames,
			videoAlertsFound,
			setConfig,
			uploadModel,
			uploadImage,
			uploadVideo,
			refreshData,
			clearAllIncidents,
			toggleDarkMode,
			setVideoProcessingState,
			setVideoProgress,
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
