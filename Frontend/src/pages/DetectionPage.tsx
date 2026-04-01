import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Upload,
	Image as ImageIcon,
	Video,
	CheckCircle2,
	AlertTriangle,
	ShieldAlert,
	ShieldCheck,
	Play,
	Square,
	Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { PPE_CLASSES, type Detection } from "@/lib/ppe-types";
import { usePPE } from "@/contexts/PPEContext";

type MediaType = "none" | "image" | "video";
type AlertLevel = "clear" | "potential" | "confirmed";

const API_BASE =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

function DropZone({
	onFileSelect,
}: {
	onFileSelect: (type: MediaType, file?: File) => void;
}) {
	const [dragOver, setDragOver] = useState(false);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			const file = e.dataTransfer.files[0];
			if (!file) return;
			if (file.type.startsWith("image/")) onFileSelect("image", file);
			else if (file.type.startsWith("video/")) onFileSelect("video", file);
		},
		[onFileSelect],
	);

	return (
		<div
			className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
				dragOver
					? "border-primary bg-primary/5"
					: "border-border hover:border-primary/50"
			}`}
			onDragOver={(e) => {
				e.preventDefault();
				setDragOver(true);
			}}
			onDragLeave={() => setDragOver(false)}
			onDrop={handleDrop}
		>
			<Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
			<p className="text-sm font-medium text-foreground">
				Drop image or video here
			</p>
			<p className="text-xs text-muted-foreground mt-1">
				JPG, PNG, MP4, AVI supported
			</p>
		</div>
	);
}

function AlertBanner({ level }: { level: AlertLevel }) {
	if (level === "clear")
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				className="flex items-center gap-2 rounded-lg bg-safety-green/10 border border-safety-green/30 px-4 py-3"
			>
				<ShieldCheck className="h-5 w-5 text-safety-green" />
				<span className="text-sm font-medium text-safety-green">
					All Clear — Full PPE Compliance
				</span>
			</motion.div>
		);
	if (level === "potential")
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				className="flex items-center gap-2 rounded-lg bg-safety-orange/10 border border-safety-orange/30 px-4 py-3"
			>
				<AlertTriangle className="h-5 w-5 text-safety-orange" />
				<span className="text-sm font-medium text-safety-orange">
					Potential Violation — Confirming...
				</span>
			</motion.div>
		);
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="flex items-center gap-2 rounded-lg bg-safety-red/10 border border-safety-red/30 px-4 py-3 animate-pulse-glow"
		>
			<ShieldAlert className="h-5 w-5 text-safety-red" />
			<span className="text-sm font-medium text-safety-red">
				⚠ CONFIRMED BREACH — Missing PPE Detected
			</span>
		</motion.div>
	);
}

function ImageResult({ detections }: { detections: Detection[] }) {
	const hasViolation = detections.some((d) => d.is_violation);
	const alertLevel: AlertLevel = hasViolation ? "confirmed" : "clear";

	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			className="space-y-4"
		>
			<AlertBanner level={alertLevel} />
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<Card>
					<CardContent className="p-0">
						<div className="relative bg-muted rounded-lg aspect-video flex items-center justify-center overflow-hidden">
							<div className="absolute inset-0 bg-gradient-to-br from-muted to-secondary/50" />
							{detections.map((det, i) => {
								const cls = PPE_CLASSES.find((c) => c.name === det.class_name);
								return (
									<motion.div
										key={i}
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ delay: i * 0.1 }}
										className="absolute border-2 rounded-sm"
										style={{
											borderColor: cls?.color || "#fff",
											left: `${(det.bbox[0] / 640) * 100}%`,
											top: `${(det.bbox[1] / 640) * 100}%`,
											width: `${((det.bbox[2] - det.bbox[0]) / 640) * 100}%`,
											height: `${((det.bbox[3] - det.bbox[1]) / 640) * 100}%`,
										}}
									>
										<span
											className="absolute -top-5 left-0 text-[9px] px-1 rounded font-mono"
											style={{ backgroundColor: cls?.color, color: "#fff" }}
										>
											{det.class_name} {(det.confidence * 100).toFixed(0)}%
										</span>
									</motion.div>
								);
							})}
							<span className="relative z-10 text-xs text-muted-foreground">
								Annotated Preview
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">
							Detections ({detections.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-xs">Class</TableHead>
									<TableHead className="text-xs">Confidence</TableHead>
									<TableHead className="text-xs">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{detections.map((det, i) => {
									const cls = PPE_CLASSES.find(
										(c) => c.name === det.class_name,
									);
									return (
										<TableRow key={i}>
											<TableCell className="py-2">
												<div className="flex items-center gap-2">
													<div
														className="h-2.5 w-2.5 rounded-full"
														style={{ backgroundColor: cls?.color }}
													/>
													<span className="text-xs font-medium">
														{det.class_name}
													</span>
												</div>
											</TableCell>
											<TableCell className="py-2">
												<span className="text-xs font-mono">
													{(det.confidence * 100).toFixed(1)}%
												</span>
											</TableCell>
											<TableCell className="py-2">
												{det.is_violation ? (
													<Badge variant="destructive" className="text-[10px]">
														Violation
													</Badge>
												) : (
													<Badge
														variant="outline"
														className="text-[10px] border-safety-green/30 text-safety-green"
													>
														OK
													</Badge>
												)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>
		</motion.div>
	);
}

function VideoResult({ file }: { file: File }) {
	const [progress, setProgress] = useState(0);
	const [processing, setProcessing] = useState(false);
	const [resultMessage, setResultMessage] = useState("");
	const { metrics, refreshData } = usePPE();
	const fileUrl = useRef(URL.createObjectURL(file));

	// Remove the mock timer and replace with an API call
	useEffect(() => {
		let active = true;
		const currentUrl = fileUrl.current;
		const processVideo = async () => {
			setProcessing(true);
			setProgress(10);
			try {
				const formData = new FormData();
				formData.append("file", file);
				setProgress(30);
				const res = await fetch(`${API_BASE}/detect/video`, {
					method: "POST",
					body: formData,
				});
				setProgress(80);
				if (res.ok) {
					const data = await res.json();
					if (active) {
						setResultMessage(
							`Processed ${data.frames_processed} frames. Found ${data.alerts_count} alerts.`,
						);
					}
				}
			} catch (e) {
				console.error("Video processing failed", e);
			}
			if (active) {
				setProgress(100);
				setProcessing(false);
				refreshData();
			}
		};
		processVideo();
		return () => {
			active = false;
			URL.revokeObjectURL(currentUrl);
		};
	}, [file, refreshData]);

	// Derived alert level from total metrics for demonstration
	const recentAlerts = metrics.confirmed_alerts;
	const hasBreach = recentAlerts > 0;

	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			className="space-y-4"
		>
			{hasBreach && <AlertBanner level="confirmed" />}
			{!hasBreach && processing && <AlertBanner level="potential" />}
			{!hasBreach && !processing && <AlertBanner level="clear" />}

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

export default function DetectionPage() {
	const [mediaType, setMediaType] = useState<MediaType>("none");
	const [detections, setDetections] = useState<Detection[]>([]);
	const [currentFile, setCurrentFile] = useState<File | null>(null);
	const { config, refreshData } = usePPE();

	const handleFileSelect = async (type: MediaType, file?: File) => {
		setMediaType(type);
		setCurrentFile(file || null);
		if (file && type === "image") {
			try {
				const formData = new FormData();
				formData.append("file", file);
				const res = await fetch(`${API_BASE}/detect/image`, {
					method: "POST",
					body: formData,
				});
				if (res.ok) {
					const data = await res.json();
					setDetections(data.detections || []);
					refreshData(); // get updated metrics/incidents
				} else {
					setDetections([]);
				}
			} catch (err) {
				console.error("Backend connection failed", err);
				setDetections([]);
			}
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
								onClick={() => {
									setMediaType("none");
									setCurrentFile(null);
								}}
							>
								← Back
							</Button>
						</div>
						<ImageResult detections={detections} />
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
								onClick={() => {
									setMediaType("none");
									setCurrentFile(null);
								}}
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
