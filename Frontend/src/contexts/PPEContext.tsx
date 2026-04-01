import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
	useMemo,
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
	detectVideo,
} from "@/lib";
import type {
	AppConfig,
	SessionMetrics,
	Incident,
	DetectionResponse,
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

	// Actions
	setConfig: (partial: Partial<AppConfig>) => Promise<void>;
	uploadModel: (file: File) => Promise<boolean>;
	uploadImage: (file: File) => Promise<DetectionResponse | null>;
	uploadVideo: (file: File) => Promise<void>;
	refreshData: () => Promise<void>;
	clearAllIncidents: () => Promise<void>;
	toggleDarkMode: () => void;
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

	// Upload video for detection
	const uploadVideo = useCallback(
		async (file: File): Promise<void> => {
			setIsLoading(true);
			try {
				await detectVideo(file);
				await refreshData();
				toast.success("Video processing complete");
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to process video";
				toast.error(message);
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
			setConfig,
			uploadModel,
			uploadImage,
			uploadVideo,
			refreshData,
			clearAllIncidents,
			toggleDarkMode,
		}),
		[
			config,
			metrics,
			incidents,
			imageDimensions,
			isDarkMode,
			sessionStart,
			isLoading,
			setConfig,
			uploadModel,
			uploadImage,
			uploadVideo,
			refreshData,
			clearAllIncidents,
			toggleDarkMode,
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
