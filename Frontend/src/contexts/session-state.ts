// UI state that survives reloads, and its mapping to the backend session document.

import type { Detection, SessionState, VideoProgressState } from "@/lib";

export type MediaKind = "image" | "video" | "none";

export interface VideoState extends VideoProgressState {
	jobId: string | null;
	videoFileName: string | null;
}

export interface DetectionState {
	mediaType: MediaKind;
	detections: Detection[];
	imageFileName: string | null;
	videoFileName: string | null;
	isImageProcessing: boolean;
}

export const initialVideoState: VideoState = {
	processing: false,
	progress: 0,
	framesProcessed: 0,
	totalFrames: 0,
	alertsFound: 0,
	jobId: null,
	videoFileName: null,
};

export const initialDetectionState: DetectionState = {
	mediaType: "none",
	detections: [],
	imageFileName: null,
	videoFileName: null,
	isImageProcessing: false,
};

interface PersistedUI {
	confidence: number;
	iou: number;
	isDarkMode: boolean;
	video: VideoState;
	detection: DetectionState;
}

export function toSessionState(ui: PersistedUI): SessionState {
	return {
		config: {
			confidence_threshold: ui.confidence,
			nms_iou_threshold: ui.iou,
			is_dark_mode: ui.isDarkMode,
		},
		video_progress: {
			processing: ui.video.processing,
			progress: ui.video.progress,
			frames_processed: ui.video.framesProcessed,
			total_frames: ui.video.totalFrames,
			alerts_found: ui.video.alertsFound,
			video_filename: ui.video.videoFileName,
			job_id: ui.video.jobId,
		},
		detection_page: {
			media_type: ui.detection.mediaType,
			detections: ui.detection.detections,
			image_filename: ui.detection.imageFileName,
			video_filename: ui.detection.videoFileName,
			is_image_processing: ui.detection.isImageProcessing,
		},
	};
}

export function videoFromSession(
	v: SessionState["video_progress"],
): VideoState {
	return {
		processing: v.processing,
		progress: v.progress,
		framesProcessed: v.frames_processed,
		totalFrames: v.total_frames,
		alertsFound: v.alerts_found,
		jobId: v.job_id,
		videoFileName: v.video_filename,
	};
}

export function detectionFromSession(
	d: SessionState["detection_page"],
): DetectionState {
	return {
		mediaType: d.media_type,
		detections: d.detections,
		imageFileName: d.image_filename,
		videoFileName: d.video_filename,
		isImageProcessing: d.is_image_processing,
	};
}
