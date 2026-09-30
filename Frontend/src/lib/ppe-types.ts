// PPE class definitions and shared types/constants

// status: "violation" classes raise incidents on the backend; "advisory" is a
// missing item that is reported but does not raise an incident.
// ink: label text colour that stays readable on the class colour.
export const PPE_CLASSES = [
	{ name: "Hardhat", color: "#2FB36B", status: "compliance", ink: "#FFFFFF" },
	{ name: "Mask", color: "#14A89A", status: "compliance", ink: "#FFFFFF" },
	{ name: "NO-Hardhat", color: "#E5352B", status: "violation", ink: "#FFFFFF" },
	{ name: "NO-Mask", color: "#F2811D", status: "advisory", ink: "#1B1A18" },
	{
		name: "NO-Safety Vest",
		color: "#C21F5B",
		status: "violation",
		ink: "#FFFFFF",
	},
	{ name: "Person", color: "#FFCC00", status: "neutral", ink: "#1B1A18" },
	{ name: "Safety Cone", color: "#B07CF0", status: "neutral", ink: "#1B1A18" },
	{
		name: "Safety Vest",
		color: "#86C232",
		status: "compliance",
		ink: "#1B1A18",
	},
	{ name: "machinery", color: "#3B82F6", status: "neutral", ink: "#FFFFFF" },
	{ name: "vehicle", color: "#94A3B8", status: "neutral", ink: "#1B1A18" },
] as const;

export type PPEClass = (typeof PPE_CLASSES)[number];

export function getPPEClass(name: string): PPEClass | undefined {
	return PPE_CLASSES.find((c) => c.name === name);
}

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
	frame_number: number | null;
	image_path?: string;
	image_filename?: string;
	is_video?: boolean;
	video_filename?: string;
	source_filename?: string;
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

export interface VideoProgressState {
	processing: boolean;
	progress: number;
	framesProcessed: number;
	totalFrames: number;
	alertsFound: number;
}

// Saved state interfaces for localStorage persistence
export interface SavedDetectionState {
	mediaType: "image" | "video" | "none";
	detections: Detection[];
	imageUrl: string | null;
	timestamp: number;
}

export interface SavedVideoState {
	fileName: string;
	fileSize: number;
	fileType: string;
	timestamp: number;
	jobId?: string; // Optional job ID for async processing
}

// Video job status for async processing
export interface VideoJobStatus {
	job_id: string;
	status: "pending" | "processing" | "completed" | "failed";
	progress_percent: number;
	frames_processed: number;
	total_frames: number;
	alerts_found: number;
	video_filename: string;
	error_message?: string;
}

// Session state for backend persistence
export interface SessionState {
	config: {
		confidence_threshold: number;
		nms_iou_threshold: number;
		is_dark_mode: boolean;
	};
	video_progress: {
		processing: boolean;
		progress: number;
		frames_processed: number;
		total_frames: number;
		alerts_found: number;
		video_filename: string | null;
		job_id: string | null;
	};
	detection_page: {
		media_type: "image" | "video" | "none";
		detections: Detection[];
		image_filename: string | null;
		video_filename: string | null;
		is_image_processing: boolean;
	};
	last_updated?: string;
}

// Display names that read as plain language ("No hard hat", "Safety vest").
const CLASS_LABELS: Record<string, string> = {
	Hardhat: "Hard hat",
	Mask: "Mask",
	"NO-Hardhat": "No hard hat",
	"NO-Mask": "No mask",
	"NO-Safety Vest": "No safety vest",
	Person: "Person",
	"Safety Cone": "Safety cone",
	"Safety Vest": "Safety vest",
	machinery: "Machinery",
	vehicle: "Vehicle",
};

export function formatClassName(name: string): string {
	return CLASS_LABELS[name] ?? name.replace(/-/g, " ");
}
