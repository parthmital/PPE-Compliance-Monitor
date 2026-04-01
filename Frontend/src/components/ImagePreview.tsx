import { motion } from "framer-motion";
import { PPE_CLASSES, formatClassName, type Detection } from "@/lib/ppe-types";

interface ImagePreviewProps {
	detections: Detection[];
	imageUrl?: string;
	imageDimensions?: { width: number; height: number } | null;
	className?: string;
}

export function ImagePreview({
	detections,
	imageUrl,
	imageDimensions,
	className = "",
}: ImagePreviewProps) {
	const imgWidth = imageDimensions?.width || 640;
	const imgHeight = imageDimensions?.height || 640;

	return (
		<div
			className={`relative bg-muted rounded-lg flex items-center justify-center overflow-hidden max-h-[60vh] ${className}`}
		>
			{imageUrl ? (
				<img
					src={imageUrl}
					alt="Uploaded"
					className="w-full h-auto max-h-[60vh] object-contain"
				/>
			) : (
				<div className="w-full h-64 bg-gradient-to-br from-muted to-secondary/50 flex items-center justify-center">
					<span className="text-xs text-muted-foreground">No image</span>
				</div>
			)}

			{detections.map((det, i) => {
				const cls = PPE_CLASSES.find((c) => c.name === det.class_name);
				const left = (det.bbox[0] / imgWidth) * 100;
				const top = (det.bbox[1] / imgHeight) * 100;
				const width = ((det.bbox[2] - det.bbox[0]) / imgWidth) * 100;
				const height = ((det.bbox[3] - det.bbox[1]) / imgHeight) * 100;

				return (
					<motion.div
						key={i}
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: i * 0.1 }}
						className="absolute border-2 rounded-sm pointer-events-none"
						style={{
							borderColor: cls?.color || "#fff",
							left: `${left}%`,
							top: `${top}%`,
							width: `${width}%`,
							height: `${height}%`,
						}}
					>
						<span
							className="absolute -top-5 left-0 text-[9px] px-1 rounded font-mono whitespace-nowrap"
							style={{ backgroundColor: cls?.color, color: "#fff" }}
						>
							{formatClassName(det.class_name)}{" "}
							{(det.confidence * 100).toFixed(0)}%
						</span>
					</motion.div>
				);
			})}
		</div>
	);
}
