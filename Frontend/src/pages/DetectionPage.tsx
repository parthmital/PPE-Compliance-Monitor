import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Boxes, FileImage, Loader2, Plus, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePPE } from "@/contexts/PPEContext";
import {
	DetectionList,
	DetectionSettings,
	DropZone,
	EmptyState,
	FileUploadButton,
	ImagePreview,
	PageHeader,
	VerdictBar,
	VideoPlayer,
	type MediaType,
} from "@/components";
import { formatClassName, formatCount, type Detection } from "@/lib";

// Temporal buffer length on the backend: a violation must persist this many
// consecutive frames before it becomes an alert.
const CONFIRM_FRAMES = 5;

// Main column plus a right-hand column that always ends with the settings.
function Workspace({
	children,
	aside,
}: {
	children: React.ReactNode;
	aside?: React.ReactNode;
}) {
	return (
		<div className="animate-enter grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
			<div className="min-w-0 space-y-4">{children}</div>
			<aside className="space-y-4">
				{aside}
				<DetectionSettings />
			</aside>
		</div>
	);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-2">
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd className="font-mono text-[13px] font-medium">{value}</dd>
		</div>
	);
}

function VideoResult({ file }: { file: File | null }) {
	const [resultAlerts, setResultAlerts] = useState<number | null>(null);
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
					setResultAlerts(result?.alerts_count || 0);
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

	const getETA = () => {
		if (!startTime || framesProcessed === 0) return "Estimating…";
		const elapsed = (Date.now() - startTime) / 1000;
		const fps = framesProcessed / elapsed;
		const remaining = totalFrames - framesProcessed;
		const etaMins = Math.ceil(remaining / fps / 60);
		return etaMins <= 1 ? "Under 1 min" : `About ${etaMins} min`;
	};

	const alerts = resultAlerts ?? alertsFound;
	const frames =
		totalFrames > 0
			? `${formatCount(framesProcessed)} / ${formatCount(totalFrames)}`
			: formatCount(framesProcessed);

	const verdict = processing ? (
		<VerdictBar
			verdict="analysing"
			title="Analysing video…"
			detail={`Frame ${frames}. Alerts appear in Incidents as they are confirmed.`}
		/>
	) : alerts > 0 ? (
		<VerdictBar
			verdict="breach"
			title={`${alerts} violation ${alerts === 1 ? "alert" : "alerts"} raised`}
			detail={
				<>
					Each alert is a missing hard hat or safety vest held for{" "}
					{CONFIRM_FRAMES} consecutive frames.{" "}
					<Link
						to="/incidents"
						className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4"
					>
						Review incidents
					</Link>
				</>
			}
		/>
	) : (
		<VerdictBar
			verdict="clear"
			title="No violations confirmed"
			detail={`No missing hard hat or safety vest persisted for ${CONFIRM_FRAMES} consecutive frames.`}
		/>
	);

	const badge = processing && (
		<span className="flex items-center gap-2 rounded-md bg-black/70 px-2 py-1 font-mono text-xs text-white">
			<span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
			Frame {frames}
		</span>
	);

	return (
		<Workspace
			aside={
				<Panel>
					<PanelHeader
						title="Progress"
						action={
							processing && (
								<span className="flex items-center gap-1.5 text-xs font-semibold text-warning">
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									Running
								</span>
							)
						}
					/>
					<div className="p-4">
						{processing && (
							<div className="mb-3">
								<div className="mb-2 flex items-baseline justify-between">
									<span className="font-mono text-2xl font-semibold">
										{progress.toFixed(0)}%
									</span>
									<span className="text-xs text-muted-foreground">
										{getETA()}
									</span>
								</div>
								<Progress
									value={progress}
									aria-label="Video analysis progress"
								/>
							</div>
						)}
						<dl className="divide-y">
							<Row label="Frames" value={frames} />
							<Row
								label="Alerts raised"
								value={
									<span className={alerts > 0 ? "text-danger" : undefined}>
										{formatCount(alerts)}
									</span>
								}
							/>
						</dl>
					</div>
				</Panel>
			}
		>
			{verdict}
			<VideoPlayer src={fileUrl.current} badge={badge} />
		</Workspace>
	);
}

function describeViolations(detections: Detection[]): string {
	const counts = new Map<string, number>();
	for (const d of detections) {
		if (d.is_violation)
			counts.set(d.class_name, (counts.get(d.class_name) ?? 0) + 1);
	}
	return [...counts]
		.map(([name, n]) => `${formatClassName(name)}${n > 1 ? ` ×${n}` : ""}`)
		.join(", ");
}

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
	const violations = detections.filter((d) => d.is_violation).length;

	const verdict = isProcessing ? (
		<VerdictBar
			verdict="analysing"
			title="Analysing photo…"
			detail={fileName}
		/>
	) : violations > 0 ? (
		<VerdictBar
			verdict="breach"
			title={`${violations} PPE ${violations === 1 ? "violation" : "violations"} found`}
			detail={`${describeViolations(detections)}. Logged in Incidents.`}
		/>
	) : (
		<VerdictBar
			verdict="clear"
			title="No PPE violations found"
			detail={`${detections.length} ${detections.length === 1 ? "object" : "objects"} detected, none missing a hard hat or safety vest.`}
		/>
	);

	return (
		<Workspace
			aside={
				<Panel>
					<PanelHeader
						title="Detections"
						action={
							!isProcessing && (
								<span className="font-mono text-xs text-muted-foreground">
									{detections.length}
								</span>
							)
						}
					/>
					<DetectionList detections={detections} loading={isProcessing} />
				</Panel>
			}
		>
			{verdict}
			{imageUrl ? (
				<ImagePreview
					detections={isProcessing ? [] : detections}
					imageUrl={imageUrl}
					imageDimensions={imageDimensions}
				/>
			) : (
				<Panel>
					<EmptyState icon={FileImage} title="Photo preview not available">
						{fileName ? `${fileName}: ` : ""}the preview is cleared on page
						reload. Detection results are kept alongside.
					</EmptyState>
				</Panel>
			)}
		</Workspace>
	);
}

// Shown instead of the drop zone when analysis can't run yet.
function NotReady() {
	const { connection, uploadModel } = usePPE();

	const content =
		connection === "connecting" ? (
			<EmptyState
				icon={Loader2}
				title="Connecting to the detection server…"
				className="[&_svg]:animate-spin"
			/>
		) : connection === "offline" ? (
			<EmptyState icon={WifiOff} title="Detection server offline">
				Start the backend to analyse media. This page reconnects automatically.
			</EmptyState>
		) : (
			<EmptyState
				icon={Boxes}
				title="No model loaded"
				action={
					<FileUploadButton
						onUpload={uploadModel}
						accept=".pt,.pth,.onnx"
						label="Upload weights"
						busyLabel="Loading model…"
						variant="default"
						size="default"
					/>
				}
			>
				Upload trained YOLO weights (.pt) to start analysing photos and videos.
			</EmptyState>
		);

	return (
		<Panel className="flex min-h-[340px] items-center justify-center">
			{content}
		</Panel>
	);
}

export default function DetectionPage() {
	// Use PPEContext for persistent state
	const {
		connection,
		config,
		uploadImage,
		imageDimensions,
		videoProcessing,
		videoProgress,
		videoFramesProcessed,
		setVideoProcessing,
		// Detection page state from context
		detectionMediaType,
		detectionDetections,
		detectionImageFileName,
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

	const handleNewAnalysis = () => {
		// Revoke object URL if exists
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
		}
		setImageUrl(null);
		clearDetectionState();
		setCurrentFile(null);
		// Clear video processing state when explicitly starting over
		setVideoProcessing(false);
	};

	const mediaType = detectionMediaType;
	const hasVideoProcessing =
		videoProcessing || videoProgress > 0 || videoFramesProcessed > 0;
	const showVideo =
		mediaType === "video" && (currentFile || hasVideoProcessing);
	const showingResult = mediaType === "image" || showVideo;
	const ready = connection === "online" && config.model_loaded;

	return (
		<>
			<PageHeader
				title="Analyse"
				description="Check a site photo or video for missing hard hats and safety vests."
				actions={
					showingResult && (
						<Button variant="secondary" onClick={handleNewAnalysis}>
							<Plus />
							New analysis
						</Button>
					)
				}
			/>

			{mediaType === "image" && (
				<ImageResult
					detections={detectionDetections}
					imageUrl={imageUrl || undefined}
					imageDimensions={imageDimensions}
					isProcessing={detectionIsImageProcessing}
					fileName={detectionImageFileName}
				/>
			)}
			{showVideo && <VideoResult file={currentFile} />}
			{!showingResult && (
				<Workspace>
					{ready ? <DropZone onFileSelect={handleFileSelect} /> : <NotReady />}
				</Workspace>
			)}
		</>
	);
}
