// PPE class definitions and shared types/constants

export const PPE_CLASSES = [
	{
		name: "Hardhat",
		color: "#22c55e",
		status: "compliance" as const,
		emoji: "🟢",
	},
	{
		name: "Mask",
		color: "#14b8a6",
		status: "compliance" as const,
		emoji: "🟢",
	},
	{
		name: "NO-Hardhat",
		color: "#ef4444",
		status: "violation" as const,
		emoji: "🔴",
	},
	{
		name: "NO-Mask",
		color: "#f97316",
		status: "violation" as const,
		emoji: "🔴",
	},
	{
		name: "NO-Safety Vest",
		color: "#b91c1c",
		status: "violation" as const,
		emoji: "🔴",
	},
	{ name: "Person", color: "#eab308", status: "neutral" as const, emoji: "🟡" },
	{
		name: "Safety Cone",
		color: "#f97316",
		status: "neutral" as const,
		emoji: "🟡",
	},
	{
		name: "Safety Vest",
		color: "#84cc16",
		status: "compliance" as const,
		emoji: "🟢",
	},
	{
		name: "machinery",
		color: "#06b6d4",
		status: "neutral" as const,
		emoji: "🟡",
	},
	{
		name: "vehicle",
		color: "#0d9488",
		status: "neutral" as const,
		emoji: "🟡",
	},
] as const;

export interface Detection {
	class_name: string;
	confidence: number;
	bbox: [number, number, number, number];
	is_violation: boolean;
}

export interface Incident {
	id: string;
	timestamp: string;
	missing_ppe: string[];
	frame_number: number;
	image_path?: string;
	image_filename?: string;
}

export interface SessionMetrics {
	safety_score: number;
	detection_accuracy: number;
	alerts_per_hour: number;
	false_alarm_rate: number;
	frames_processed: number;
	violation_frames: number;
	confirmed_alerts: number;
	persons_detected: number;
}

export interface AppConfig {
	confidence_threshold: number;
	nms_iou_threshold: number;
	model_loaded: boolean;
	model_name: string;
}

export interface DetectionResponse {
	detections: Detection[];
	image_width: number;
	image_height: number;
}

// Helper to format class names for display
export function formatClassName(name: string): string {
	// Replace hyphens with spaces and capitalize each word
	return name.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
