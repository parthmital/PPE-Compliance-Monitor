import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Video, CheckCircle2, Loader2 } from "lucide-react";
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

// Video Result Component
function VideoResult({ file }: { file: File }) {
	const [progress, setProgress] = useState(0);
	const [processing, setProcessing] = useState(false);
	const [resultMessage, setResultMessage] = useState("");
	const { metrics, uploadVideo, refreshData } = usePPE();
	const fileUrl = useRef(URL.createObjectURL(file));

	useEffect(() => {
		let active = true;
		const currentUrl = fileUrl.current;

		const process = async () => {
			setProcessing(true);
			setProgress(10);
			try {
				setProgress(30);
				await uploadVideo(file);
				if (active) {
					setResultMessage("Video processing complete");
				}
			} catch (e) {
				console.error("Video processing failed", e);
			} finally {
				if (active) {
					setProgress(100);
					setProcessing(false);
					refreshData();
				}
			}
		};

		process();
		return () => {
			active = false;
			URL.revokeObjectURL(currentUrl);
		};
	}, [file, uploadVideo, refreshData]);

	const hasBreach = metrics.confirmed_alerts > 0;

	const getAlertLevel = (): AlertLevel => {
		if (hasBreach) return "confirmed";
		if (processing) return "potential";
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
							<div className="relative bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden">
								<video
									src={fileUrl.current}
									autoPlay
									loop
									muted
									className="absolute inset-0 w-full h-full object-contain opacity-50"
								/>
								{processing && (
									<div className="absolute top-3 left-3 flex items-center gap-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-mono z-10">
										<div className="h-2 w-2 rounded-full bg-safety-red animate-pulse" />
										Processing on Backend...
									</div>
								)}
								{!processing && resultMessage && (
									<div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
										<span className="text-white font-medium bg-black/80 px-4 py-2 rounded-lg">
											{resultMessage}
										</span>
									</div>
								)}
							</div>
							<div className="p-3 space-y-2">
								<Progress value={progress} className="h-1.5" />
								<div className="flex items-center justify-between">
									<span className="text-xs text-muted-foreground font-mono">
										{progress.toFixed(0)}%
									</span>
									{processing ? (
										<span className="flex items-center gap-1 text-safety-orange text-xs">
											<Loader2 className="h-3 w-3 animate-spin" /> Active
										</span>
									) : (
										<span className="flex items-center gap-1 text-safety-green text-xs">
											<CheckCircle2 className="h-3 w-3" /> Complete
										</span>
									)}
								</div>
							</div>
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
}: {
	detections: Detection[];
	imageUrl?: string;
	imageDimensions?: { width: number; height: number } | null;
}) {
	const hasViolation = detections.some((d) => d.is_violation);
	const alertLevel: AlertLevel = hasViolation ? "confirmed" : "clear";

	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			className="space-y-4"
		>
			<AlertBanner level={alertLevel} />
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
							Detections ({detections.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<DetectionTable detections={detections} />
					</CardContent>
				</Card>
			</div>
		</motion.div>
	);
}

// Main Detection Page
const STORAGE_KEY = "ppe_detection_state";

interface SavedDetectionState {
	mediaType: MediaType | "none";
	detections: Detection[];
	imageUrl: string | null;
	timestamp: number;
}

export default function DetectionPage() {
	const [mediaType, setMediaType] = useState<MediaType | "none">("none");
	const [detections, setDetections] = useState<Detection[]>([]);
	const [currentFile, setCurrentFile] = useState<File | null>(null);
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const { config, uploadImage, imageDimensions } = usePPE();

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
	}, []);

	// Persist state when detection data changes
	useEffect(() => {
		if (mediaType === "image" && imageUrl) {
			const state: SavedDetectionState = {
				mediaType,
				detections,
				imageUrl,
				timestamp: Date.now(),
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		}
	}, [mediaType, detections, imageUrl]);

	const handleFileSelect = async (type: MediaType, file?: File) => {
		setMediaType(type);
		setCurrentFile(file || null);

		if (file && type === "image") {
			const url = URL.createObjectURL(file);
			setImageUrl(url);

			const result = await uploadImage(file);
			if (result) {
				setDetections(result.detections || []);
			} else {
				setDetections([]);
			}
		}
	};

	const handleBack = () => {
		setMediaType("none");
		setCurrentFile(null);
		setDetections([]);
		localStorage.removeItem(STORAGE_KEY);
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
						/>
					</motion.div>
				)}
				{mediaType === "video" && currentFile && (
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
