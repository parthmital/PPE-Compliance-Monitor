import React, {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
} from "react";
import type {
	SessionMetrics,
	AppConfig,
	Incident,
	Detection,
} from "@/lib/ppe-types";

// Base API URL
const API_BASE =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface PPEContextType {
	metrics: SessionMetrics;
	config: AppConfig;
	incidents: Incident[];
	detections: Detection[];
	sessionStart: Date;
	isDarkMode: boolean;
	setConfig: (config: Partial<AppConfig>) => void;
	addIncident: (incident: Incident) => void;
	clearIncidents: () => void;
	setDetections: (detections: Detection[]) => void;
	setMetrics: (metrics: Partial<SessionMetrics>) => void;
	toggleDarkMode: () => void;
	refreshData: () => Promise<void>;
}

const defaultMetrics: SessionMetrics = {
	safety_score: 100,
	detection_accuracy: 0.87,
	alerts_per_hour: 0,
	false_alarm_rate: 0,
	frames_processed: 0,
	violation_frames: 0,
	confirmed_alerts: 0,
	persons_detected: 0,
};

const defaultConfig: AppConfig = {
	confidence_threshold: 0.45,
	nms_iou_threshold: 0.5,
	model_loaded: false,
	model_name: "",
};

const PPEContext = createContext<PPEContextType | null>(null);

export function PPEProvider({ children }: { children: React.ReactNode }) {
	const [metrics, setMetricsState] = useState<SessionMetrics>(defaultMetrics);
	const [config, setConfigState] = useState<AppConfig>(defaultConfig);
	const [incidents, setIncidents] = useState<Incident[]>([]);
	const [detections, setDetections] = useState<Detection[]>([]);
	const [isDarkMode, setIsDarkMode] = useState(true);
	const [sessionStart] = useState(new Date());

	useEffect(() => {
		document.documentElement.classList.toggle("dark", isDarkMode);
	}, [isDarkMode]);

	const refreshData = useCallback(async () => {
		try {
			const urls = [
				`${API_BASE}/config`,
				`${API_BASE}/metrics`,
				`${API_BASE}/incidents`,
			];

			const responses = await Promise.allSettled(urls.map((url) => fetch(url)));

			const [confRes, metricsRes, incRes] = responses;

			if (confRes.status === "fulfilled" && confRes.value.ok) {
				const confData = await confRes.value.json();
				setConfigState((prev) => ({ ...prev, ...confData }));
			}

			if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
				const metData = await metricsRes.value.json();
				setMetricsState((prev) => ({ ...prev, ...metData.metrics }));
			}

			if (incRes.status === "fulfilled" && incRes.value.ok) {
				const incData = await incRes.value.json();
				setIncidents(incData.incidents || []);
			}
		} catch (err) {
			console.error("Failed to fetch data from backend", err);
		}
	}, []);

	useEffect(() => {
		refreshData();
		const interval = setInterval(refreshData, 2000);
		return () => clearInterval(interval);
	}, [refreshData]);

	const setConfig = useCallback((partial: Partial<AppConfig>) => {
		setConfigState((prev) => ({ ...prev, ...partial }));
	}, []);

	const addIncident = useCallback((incident: Incident) => {
		// Only local optimistic update. In real app, you'd probably refetch.
		setIncidents((prev) => [incident, ...prev]);
	}, []);

	const clearIncidents = useCallback(async () => {
		try {
			await fetch(`${API_BASE}/incidents/clear`, { method: "POST" });
			setIncidents([]);
		} catch (err) {
			console.error("Failed to clear incidents", err);
		}
	}, []);

	const setMetrics = useCallback((partial: Partial<SessionMetrics>) => {
		setMetricsState((prev) => ({ ...prev, ...partial }));
	}, []);

	const toggleDarkMode = useCallback(() => setIsDarkMode((v) => !v), []);

	return (
		<PPEContext.Provider
			value={{
				metrics,
				config,
				incidents,
				detections,
				sessionStart,
				isDarkMode,
				setConfig,
				addIncident,
				clearIncidents,
				setDetections,
				setMetrics,
				toggleDarkMode,
				refreshData,
			}}
		>
			{children}
		</PPEContext.Provider>
	);
}

export function usePPE() {
	const ctx = useContext(PPEContext);
	if (!ctx) throw new Error("usePPE must be used within PPEProvider");
	return ctx;
}
