import { ApiError } from "@/lib/api";
import { getVideoJobStatus } from "@/lib/detection-api";
import type { VideoJobStatus, VideoProgressState } from "@/lib/ppe-types";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 30 * 60 * 1000;

export function jobProgress(status: VideoJobStatus): VideoProgressState {
	return {
		processing: status.status === "pending" || status.status === "processing",
		progress: status.progress_percent,
		framesProcessed: status.frames_processed,
		totalFrames: status.total_frames,
		alertsFound: status.alerts_found,
	};
}

// Polls a backend video job until it completes. Rejects if it fails or times
// out, or if the backend forgot the job; other polling errors are retried.
export function waitForVideoJob(
	jobId: string,
	onProgress: (state: VideoProgressState) => void,
): Promise<VideoJobStatus> {
	return new Promise((resolve, reject) => {
		const deadline = Date.now() + TIMEOUT_MS;
		const poll = async () => {
			try {
				const status = await getVideoJobStatus(jobId);
				onProgress(jobProgress(status));
				if (status.status === "completed") return resolve(status);
				if (status.status === "failed")
					return reject(
						new Error(status.error_message || "Video processing failed"),
					);
			} catch (error) {
				// Jobs live in backend memory, so a restart forgets them.
				if (error instanceof ApiError && error.status === 404)
					return reject(new Error("Video job no longer exists"));
				console.error("Error polling job status:", error);
			}
			if (Date.now() > deadline)
				return reject(new Error("Video processing timed out"));
			setTimeout(poll, POLL_INTERVAL_MS);
		};
		setTimeout(poll, POLL_INTERVAL_MS);
	});
}
