import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Image as ImageIcon,
	Video,
	CheckCircle2,
	Loader2,
	Play,
	Pause,
	RotateCcw,
	RotateCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePPE } from "@/contexts/PPEContext";
import {
	AlertBanner,
	DropZone,
	ImagePreview,
	DetectionTable,
	type MediaType,
	type AlertLevel,
} from "@/components";
import type { Detection, SavedDetectionState, SavedVideoState } from "@/lib";

// Video Result Component
function VideoResult({ file }: { file: File }) {
	const [resultMessage, setResultMessage] = useState("");
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [showControls, setShowControls] = useState(true);
	const [startTime, setStartTime] = useState<number | null>(null);
	const {
		metrics,
		uploadVideo,
		refreshData,
		videoProcessing: processing,
		videoProgress: progress,
		videoFramesProcessed: framesProcessed,
		videoTotalFrames: totalFrames,
		videoAlertsFound: alertsFound,
		setVideoProcessing,
		setVideoProgress,
	} = usePPE();
	const fileUrl = useRef(URL.createObjectURL(file));
	const videoRef = useRef<HTMLVideoElement>(null);
	const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

	// Get video metadata (total frames estimate)
	useEffect(() => {
		const video = document.createElement("video");
		video.preload = "metadata";
		video.src = fileUrl.current;
		video.onloadedmetadata = () => {
			// Estimate total frames: duration * fps (assume 30fps if not detected)
			const fps = 30;
			const estimatedFrames = Math.floor(video.duration * fps);
			setDuration(video.duration);
			// Update global state
			setVideoProgress({
				processing: true,
				progress: 5,
				framesProcessed: 0,
				totalFrames: estimatedFrames,
				alertsFound: 0,
			});
		};
	}, [file, setVideoProgress]);

	useEffect(() => {
		let active = true;
		const currentUrl = fileUrl.current;

		const process = async () => {
			setVideoProcessing(true);
			setStartTime(Date.now());

			// Start polling for real-time stats
			pollIntervalRef.current = setInterval(() => {
				if (active) {
					refreshData();
				}
			}, 1000);

			try {
				const result = await uploadVideo(file);
				if (active) {
					setResultMessage(
						`Processing complete - ${result?.alerts_count || 0} alerts found`,
					);
				}
			} catch (e) {
				console.error("Video processing failed", e);
			} finally {
				if (pollIntervalRef.current) {
					clearInterval(pollIntervalRef.current);
				}
				if (active) {
					setVideoProcessing(false);
					setVideoProgress({
						processing: false,
						progress: 100,
						framesProcessed: totalFrames,
						totalFrames,
						alertsFound: metrics.confirmed_alerts,
					});
					refreshData();
				}
			}
		};

		process();
		return () => {
			active = false;
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
			URL.revokeObjectURL(currentUrl);
		};
	}, [
		file,
		uploadVideo,
		refreshData,
		setVideoProcessing,
		setVideoProgress,
		totalFrames,
		metrics.confirmed_alerts,
	]);

	// Update progress based on metrics polling
	useEffect(() => {
		if (processing && totalFrames > 0 && metrics.frames_processed > 0) {
			const currentProcessed = metrics.frames_processed;
			const progressPercent = Math.min(
				95,
				(currentProcessed / totalFrames) * 100,
			);
			setVideoProgress({
				processing: true,
				progress: Math.max(5, progressPercent),
				framesProcessed: currentProcessed,
				totalFrames,
				alertsFound: metrics.confirmed_alerts,
			});
		}
	}, [metrics, processing, totalFrames, setVideoProgress]);

	const togglePlay = () => {
		if (videoRef.current) {
			if (isPlaying) {
				videoRef.current.pause();
			} else {
				videoRef.current.play();
			}
			setIsPlaying(!isPlaying);
		}
	};

	const handleSeek = (seconds: number) => {
		if (videoRef.current) {
			videoRef.current.currentTime = Math.max(
				0,
				Math.min(duration, videoRef.current.currentTime + seconds),
			);
		}
	};

	const handleTimeUpdate = () => {
		if (videoRef.current) {
			setCurrentTime(videoRef.current.currentTime);
		}
	};

	const handleLoadedMetadata = () => {
		if (videoRef.current) {
			setDuration(videoRef.current.duration);
		}
	};

	const handleSeekBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newTime = parseFloat(e.target.value);
		if (videoRef.current) {
			videoRef.current.currentTime = newTime;
			setCurrentTime(newTime);
		}
	};

	const handleMouseMove = () => {
		setShowControls(true);
		if (controlsTimeoutRef.current) {
			clearTimeout(controlsTimeoutRef.current);
		}
		controlsTimeoutRef.current = setTimeout(() => {
			if (isPlaying) setShowControls(false);
		}, 3000);
	};

	const formatTime = (time: number) => {
		const mins = Math.floor(time / 60);
		const secs = Math.floor(time % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const getETA = () => {
		if (!startTime || framesProcessed === 0) return "calculating...";
		const elapsed = (Date.now() - startTime) / 1000;
		const fps = framesProcessed / elapsed;
		const remaining = totalFrames - framesProcessed;
		const etaSeconds = remaining / fps;
		const etaMins = Math.ceil(etaSeconds / 60);
		return etaMins <= 1 ? "< 1 min" : `~${etaMins} mins`;
	};

	const hasBreach = metrics.confirmed_alerts > 0;

	const getAlertLevel = (): AlertLevel => {
		if (processing) return "potential"; // Processing takes precedence
		if (hasBreach) return "confirmed";
		return "clear";
	};

	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			className="space-y-4"
		>
			<AlertBanner level={getAlertLevel()} />

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div className="lg:col-span-2">
					<Card>
						<CardContent className="p-0">
							<div
								className="relative bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden group"
								onMouseMove={handleMouseMove}
								onMouseLeave={() => isPlaying && setShowControls(false)}
							>
								<video
									ref={videoRef}
									src={fileUrl.current}
									className="absolute inset-0 w-full h-full object-contain"
									onTimeUpdate={handleTimeUpdate}
									onLoadedMetadata={handleLoadedMetadata}
									onEnded={() => setIsPlaying(false)}
									onClick={togglePlay}
								/>

								{/* Processing Overlay */}
								{processing && (
									<div className="absolute top-3 left-3 flex items-center gap-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-mono z-20">
										<div className="h-2 w-2 rounded-full bg-safety-red animate-pulse" />
										Processing Frame {framesProcessed.toLocaleString()}
										{totalFrames > 0 && ` / ${totalFrames.toLocaleString()}`}
									</div>
								)}

								{/* Result Overlay */}
								{!processing && resultMessage && (
									<div className="absolute top-3 left-3 flex items-center gap-2 bg-safety-green/80 backdrop-blur px-2 py-1 rounded text-xs font-mono z-20 text-white">
										<CheckCircle2 className="h-3 w-3" />
										{resultMessage}
									</div>
								)}

								{/* Metrics Overlay */}
								{!processing && (
									<div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
										<div className="flex items-center gap-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs">
											<span className="text-muted-foreground">Alerts:</span>
											<span
												className={`font-mono font-bold ${hasBreach ? "text-safety-red" : "text-safety-green"}`}
											>
												{metrics.confirmed_alerts}
											</span>
										</div>
										<div className="flex items-center gap-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs">
											<span className="text-muted-foreground">Safety:</span>
											<span className="font-mono font-bold text-safety-green">
												{metrics.safety_score}%
											</span>
										</div>
									</div>
								)}

								{/* Center Play Button (when paused) */}
								{!isPlaying && !processing && (
									<div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40">
										<button
											onClick={togglePlay}
											className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-all hover:scale-110"
										>
											<Play className="h-8 w-8 text-black ml-1" />
										</button>
									</div>
								)}

								{/* Video Controls */}
								<div
									className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 z-20 ${
										showControls ? "opacity-100" : "opacity-0"
									}`}
								>
									{/* Seek Bar */}
									<div className="mb-3">
										<input
											type="range"
											min={0}
											max={duration || 100}
											value={currentTime}
											onChange={handleSeekBarChange}
											className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer hover:bg-white/50"
											style={{
												background: `linear-gradient(to right, #ef4444 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.3) ${(currentTime / (duration || 1)) * 100}%)`,
											}}
										/>
									</div>

									{/* Control Buttons */}
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<button
												onClick={togglePlay}
												className="w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-all"
											>
												{isPlaying ? (
													<Pause className="h-5 w-5 text-black" />
												) : (
													<Play className="h-5 w-5 text-black ml-0.5" />
												)}
											</button>

											<button
												onClick={() => handleSeek(-10)}
												className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-all"
												title="Rewind 10s"
											>
												<RotateCcw className="h-4 w-4 text-white" />
											</button>

											<button
												onClick={() => handleSeek(10)}
												className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-all"
												title="Forward 10s"
											>
												<RotateCw className="h-4 w-4 text-white" />
											</button>
										</div>

										<div className="text-white text-xs font-mono">
											{formatTime(currentTime)} / {formatTime(duration)}
										</div>
									</div>
								</div>
							</div>

							{/* Processing Progress */}
							{processing && (
								<div className="p-3 space-y-2">
									<Progress value={progress} className="h-1.5" />
									<div className="flex items-center justify-between text-xs">
										<span className="text-muted-foreground font-mono">
											Frame {framesProcessed.toLocaleString()}
											{totalFrames > 0 &&
												` / ${totalFrames.toLocaleString()}`}{" "}
											({progress.toFixed(0)}%)
										</span>
										<span className="flex items-center gap-1 text-safety-orange">
											<Loader2 className="h-3 w-3 animate-spin" /> Active
										</span>
									</div>
									<div className="flex items-center justify-between text-xs">
										<span className="text-muted-foreground">
											Alerts: {alertsFound} | ETA: {getETA()}
										</span>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Session Live Stats</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-3">
							<div className="flex justify-between text-xs">
								<span className="text-muted-foreground">Total Alerts</span>
								<span className="font-mono text-safety-red">
									{metrics.confirmed_alerts}
								</span>
							</div>
							<div className="flex justify-between text-xs">
								<span className="text-muted-foreground">Safety Score</span>
								<span className="font-mono text-safety-green">
									{metrics.safety_score}%
								</span>
							</div>
							<div className="flex justify-between text-xs">
								<span className="text-muted-foreground">Frames Processed</span>
								<span className="font-mono">{metrics.frames_processed}</span>
							</div>
							<div className="flex justify-between text-xs">
								<span className="text-muted-foreground">Persons Detected</span>
								<span className="font-mono">{metrics.persons_detected}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</motion.div>
	);
}

// Image Result Component
function ImageResult({
	detections,
	imageUrl,
	imageDimensions,
	isProcessing,
}: {
	detections: Detection[];
	imageUrl?: string;
	imageDimensions?: { width: number; height: number } | null;
	isProcessing?: boolean;
}) {
	const hasViolation = detections.some((d) => d.is_violation);
	const alertLevel: AlertLevel = isProcessing
		? "potential"
		: hasViolation
			? "confirmed"
			: "clear";

	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			className="space-y-4"
		>
			<AlertBanner level={alertLevel} />
			{isProcessing && (
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<Loader2 className="h-3 w-3 animate-spin" />
					Processing image for PPE violations...
				</div>
			)}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
				<Card>
					<CardContent className="p-0">
						<ImagePreview
							detections={detections}
							imageUrl={imageUrl}
							imageDimensions={imageDimensions}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">
							{isProcessing
								? "Processing..."
								: `Detections (${detections.length})`}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isProcessing ? (
							<div className="flex items-center justify-center py-8 text-muted-foreground">
								<Loader2 className="h-5 w-5 animate-spin mr-2" />
								<span className="text-sm">Analyzing image...</span>
							</div>
						) : (
							<DetectionTable detections={detections} />
						)}
					</CardContent>
				</Card>
			</div>
		</motion.div>
	);
}

// Main Detection Page
const STORAGE_KEY = "ppe_detection_state";
const VIDEO_STORAGE_KEY = "ppe_video_state";

export default function DetectionPage() {
	const [mediaType, setMediaType] = useState<MediaType | "none">("none");
	const [detections, setDetections] = useState<Detection[]>([]);
	const [currentFile, setCurrentFile] = useState<File | null>(null);
	const [restoredVideoInfo, setRestoredVideoInfo] =
		useState<SavedVideoState | null>(null);
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const [isImageProcessing, setIsImageProcessing] = useState(false);
	const {
		config,
		uploadImage,
		imageDimensions,
		videoProcessing,
		videoProgress,
		videoFramesProcessed,
		videoTotalFrames,
		videoAlertsFound,
		setVideoProcessing,
		metrics,
	} = usePPE();

	// Load persisted state on mount
	useEffect(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				const state: SavedDetectionState = JSON.parse(saved);
				// Only restore if less than 30 minutes old
				const isRecent = Date.now() - state.timestamp < 30 * 60 * 1000;
				if (isRecent && state.imageUrl) {
					setMediaType(state.mediaType);
					setDetections(state.detections);
					setImageUrl(state.imageUrl);
				}
			} catch {
				// Ignore parse errors
			}
		}

		// Check for persisted video state
		const savedVideo = localStorage.getItem(VIDEO_STORAGE_KEY);
		if (savedVideo) {
			try {
				const videoState: SavedVideoState = JSON.parse(savedVideo);
				const isRecent = Date.now() - videoState.timestamp < 30 * 60 * 1000;
				// Restore video mode if there was a recent video (regardless of processing state)
				if (isRecent) {
					// Show video mode - processing state will be restored by PPEContext
					setMediaType("video");
					setRestoredVideoInfo(videoState);
				}
			} catch {
				// Ignore parse errors
			}
		}
	}, []);

	// Persist state when detection data changes
	useEffect(() => {
		if (mediaType === "image" && imageUrl && !isImageProcessing) {
			const state: SavedDetectionState = {
				mediaType,
				detections,
				imageUrl,
				timestamp: Date.now(),
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		}
	}, [mediaType, detections, imageUrl, isImageProcessing]);

	const handleFileSelect = async (type: MediaType, file?: File) => {
		setMediaType(type);
		setCurrentFile(file || null);
		setDetections([]);

		if (file && type === "image") {
			const url = URL.createObjectURL(file);
			setImageUrl(url);
			setIsImageProcessing(true);

			const result = await uploadImage(file);
			if (result) {
				setDetections(result.detections || []);
			} else {
				setDetections([]);
			}
			setIsImageProcessing(false);
		}

		if (file && type === "video") {
			// Persist video file metadata
			const videoState: SavedVideoState = {
				fileName: file.name,
				fileSize: file.size,
				fileType: file.type,
				timestamp: Date.now(),
			};
			localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videoState));
		}
	};

	const handleBack = () => {
		setMediaType("none");
		setCurrentFile(null);
		setRestoredVideoInfo(null);
		setDetections([]);
		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem(VIDEO_STORAGE_KEY);
		// Only clear video processing state when explicitly going back
		setVideoProcessing(false);
		localStorage.removeItem("ppe_video_processing");
		localStorage.removeItem("ppe_video_progress");
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
			setImageUrl(null);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Real-time Detection</h1>
					<p className="text-sm text-muted-foreground">
						Upload media for PPE compliance analysis
					</p>
				</div>
				<Badge
					variant={config.model_loaded ? "default" : "destructive"}
					className={
						config.model_loaded
							? "bg-safety-green text-safety-green-foreground gap-1"
							: "gap-1"
					}
				>
					<CheckCircle2 className="h-3 w-3" />
					Model {config.model_loaded ? "Ready" : "Not Loaded"}
				</Badge>
			</div>

			<AnimatePresence mode="wait">
				{mediaType === "none" && (
					<motion.div key="drop" exit={{ opacity: 0, y: -10 }}>
						<DropZone onFileSelect={handleFileSelect} />
					</motion.div>
				)}
				{mediaType === "image" && imageUrl && (
					<motion.div key="image">
						<div className="flex items-center justify-between mb-4">
							<Badge variant="outline" className="gap-1">
								<ImageIcon className="h-3 w-3" />
								Image Mode
							</Badge>
							<Button
								variant="ghost"
								size="sm"
								className="text-xs"
								onClick={handleBack}
							>
								← Back
							</Button>
						</div>
						<ImageResult
							detections={detections}
							imageUrl={imageUrl || undefined}
							imageDimensions={imageDimensions}
							isProcessing={isImageProcessing}
						/>
					</motion.div>
				)}
				{mediaType === "video" && (currentFile || restoredVideoInfo) && (
					<motion.div key="video">
						<div className="flex items-center justify-between mb-4">
							<Badge variant="outline" className="gap-1">
								<Video className="h-3 w-3" />
								Video Mode
								{restoredVideoInfo && !currentFile && (
									<span className="ml-2 text-xs text-muted-foreground">
										({restoredVideoInfo.fileName})
									</span>
								)}
							</Badge>
							<Button
								variant="ghost"
								size="sm"
								className="text-xs"
								onClick={handleBack}
							>
								← Back
							</Button>
						</div>
						{currentFile ? (
							<VideoResult file={currentFile} />
						) : restoredVideoInfo ? (
							// Show processing status when returning without file
							<motion.div
								initial={{ y: 10, opacity: 0 }}
								animate={{ y: 0, opacity: 1 }}
								className="space-y-4"
							>
								<AlertBanner
									level={metrics.confirmed_alerts > 0 ? "confirmed" : "clear"}
								/>
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm flex items-center gap-2">
											<Video className="h-4 w-4" />
											{restoredVideoInfo.fileName}
										</CardTitle>
									</CardHeader>
									<CardContent className="p-6">
										<div className="space-y-4">
											<div className="flex items-center gap-2 text-sm">
												{videoProcessing ? (
													<>
														<Loader2 className="h-4 w-4 animate-spin text-safety-orange" />
														<span>Processing video in background...</span>
													</>
												) : (
													<>
														<CheckCircle2 className="h-4 w-4 text-safety-green" />
														<span>Processing complete</span>
													</>
												)}
											</div>
											<Progress value={videoProgress} className="h-2" />
											<div className="flex justify-between text-xs text-muted-foreground">
												<span>
													Frame {videoFramesProcessed.toLocaleString()} /{" "}
													{videoTotalFrames.toLocaleString()}
												</span>
												<span>{videoProgress.toFixed(0)}%</span>
											</div>
											<div className="text-xs">
												Alerts found:{" "}
												<span className="font-mono text-safety-red">
													{videoAlertsFound}
												</span>
											</div>
											{!videoProcessing && (
												<div className="pt-2 border-t text-xs text-muted-foreground">
													Video file no longer available for replay. Upload
													again to view.
												</div>
											)}
										</div>
									</CardContent>
								</Card>
							</motion.div>
						) : null}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
