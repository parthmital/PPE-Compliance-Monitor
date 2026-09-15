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
import type { Detection } from "@/lib";

// STORAGE_KEYS - kept for reference but no longer used (migrated to backend)
// const STORAGE_KEYS = {
// 	DETECTION_PAGE: "ppe_detection_page",
// } as const;

function VideoResult({ file }: { file: File | null }) {
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
	const fileUrl = useRef<string | null>(
		file ? URL.createObjectURL(file) : null,
	);
	const videoRef = useRef<HTMLVideoElement>(null);
	const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const hasStartedRef = useRef(false);

	// Get video metadata (total frames estimate)
	useEffect(() => {
		if (!file || !fileUrl.current) return;

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
		// Only start processing if we have a file and haven't started yet
		if (!file || hasStartedRef.current) return;

		hasStartedRef.current = true;
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
			if (currentUrl) {
				URL.revokeObjectURL(currentUrl);
			}
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
								{fileUrl.current ? (
									<video
										ref={videoRef}
										src={fileUrl.current}
										className="absolute inset-0 w-full h-full object-contain"
										onTimeUpdate={handleTimeUpdate}
										onLoadedMetadata={handleLoadedMetadata}
										onEnded={() => setIsPlaying(false)}
										onClick={togglePlay}
									/>
								) : (
									<div className="flex flex-col items-center justify-center text-muted-foreground">
										<Video className="h-16 w-16 mb-4 opacity-50" />
										<p className="text-sm">Video file not available</p>
										<p className="text-xs opacity-70">
											Processing continues in background
										</p>
									</div>
								)}

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
								{!isPlaying && !processing && fileUrl.current && (
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
								{fileUrl.current && (
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
								)}
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
	fileName,
}: {
	detections: Detection[];
	imageUrl?: string;
	imageDimensions?: { width: number; height: number } | null;
	isProcessing?: boolean;
	fileName?: string | null;
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
						{imageUrl ? (
							<ImagePreview
								detections={detections}
								imageUrl={imageUrl}
								imageDimensions={imageDimensions}
							/>
						) : (
							<div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg aspect-video text-muted-foreground">
								<ImageIcon className="h-16 w-16 mb-4 opacity-50" />
								<p className="text-sm">
									{fileName ? fileName : "Image not available"}
								</p>
								<p className="text-xs opacity-70 mt-1">
									Detection results preserved below
								</p>
							</div>
						)}
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
export default function DetectionPage() {
	// Use PPEContext for persistent state
	const {
		uploadImage,
		imageDimensions,
		videoProcessing,
		videoProgress,
		videoFramesProcessed,
		videoTotalFrames,
		videoAlertsFound,
		setVideoProcessing,
		metrics,
		// Detection page state from context
		detectionMediaType,
		detectionDetections,
		detectionImageFileName,
		detectionVideoFileName,
		detectionIsImageProcessing,
		// Detection page actions
		setDetectionState,
		clearDetectionState,
		// Session persistence
		saveSession,
	} = usePPE();
	// Non-persisted state for File objects (cannot serialize to backend)
	const [currentFile, setCurrentFile] = useState<File | null>(null);
	// Local state for image URL (object URL - cannot be persisted)
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const { config } = usePPE();

	// Restore file from filename if needed (on mount)
	useEffect(() => {
		// If we have a video filename but no file, the video state is in PPEContext
		// The VideoResult component will need to handle this case
		// For now, we keep the video state in PPEContext which is already persisted
	}, []);

	const handleFileSelect = async (type: MediaType, file?: File) => {
		setCurrentFile(file || null);

		if (file && type === "image") {
			const url = URL.createObjectURL(file);
			setImageUrl(url);
			setDetectionState({
				mediaType: type,
				detections: [],
				imageFileName: file.name,
				videoFileName: null,
				isImageProcessing: true,
			});

			const result = await uploadImage(file);
			if (result) {
				setDetectionState({
					detections: result.detections || [],
					isImageProcessing: false,
				});
				// Immediately save session to persist detections
				await saveSession();
			} else {
				setDetectionState({
					detections: [],
					isImageProcessing: false,
				});
			}
		} else if (file && type === "video") {
			setImageUrl(null);
			setDetectionState({
				mediaType: type,
				detections: [],
				imageFileName: null,
				videoFileName: file.name,
				isImageProcessing: false,
			});
		} else {
			setImageUrl(null);
			clearDetectionState();
		}
	};

	const handleBack = () => {
		// Revoke object URL if exists
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
		}
		setImageUrl(null);
		clearDetectionState();
		setCurrentFile(null);
		// Clear video processing state when explicitly going back
		setVideoProcessing(false);
	};

	const mediaType = detectionMediaType;
	const detections = detectionDetections;
	const isImageProcessing = detectionIsImageProcessing;

	const hasVideoProcessing =
		videoProcessing || videoProgress > 0 || videoFramesProcessed > 0;
	const showVideo =
		mediaType === "video" && (currentFile || hasVideoProcessing);

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
				{mediaType === "image" && (
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
							fileName={detectionImageFileName}
						/>
					</motion.div>
				)}
				{mediaType === "video" && showVideo && (
					<motion.div key="video">
						<div className="flex items-center justify-between mb-4">
							<Badge variant="outline" className="gap-1">
								<Video className="h-3 w-3" />
								Video Mode
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
						<VideoResult file={currentFile} />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
