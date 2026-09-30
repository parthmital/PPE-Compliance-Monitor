import { useState } from "react";
import { formatClassName, getPPEClass, type Detection } from "@/lib/ppe-types";
import { cn } from "@/lib/utils";

interface ImagePreviewProps {
	detections: Detection[];
	imageUrl: string;
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
	const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

	return (
		<div
			className={cn(
				"flex items-center justify-center overflow-hidden rounded-lg border bg-neutral-950",
				className,
			)}
		>
			{/* The wrapper shrinks to the rendered image, so % boxes line up exactly. */}
			<div className="relative inline-block max-w-full">
				<img
					src={imageUrl}
					alt="Analysed site photo with detected objects outlined"
					onLoad={() => setLoadedUrl(imageUrl)}
					data-loaded={loadedUrl === imageUrl}
					className="img-fade block max-h-[62vh] w-auto max-w-full"
				/>
				{detections.map((det, i) => {
					const cls = getPPEClass(det.class_name);
					const left = (det.bbox[0] / imgWidth) * 100;
					const top = (det.bbox[1] / imgHeight) * 100;
					const width = ((det.bbox[2] - det.bbox[0]) / imgWidth) * 100;
					const height = ((det.bbox[3] - det.bbox[1]) / imgHeight) * 100;
					const labelInside = top < 6;

					return (
						<div
							key={i}
							className={cn(
								"animate-enter pointer-events-none absolute rounded-[2px]",
								det.is_violation ? "border-[3px]" : "border-2",
							)}
							style={{
								borderColor: cls?.color ?? "#FFFFFF",
								left: `${left}%`,
								top: `${top}%`,
								width: `${width}%`,
								height: `${height}%`,
							}}
						>
							<span
								className={cn(
									"absolute left-[-2px] whitespace-nowrap rounded-[2px] px-1 py-px font-mono text-[10px] font-semibold leading-tight",
									labelInside ? "top-0" : "top-0 -translate-y-full",
								)}
								style={{
									backgroundColor: cls?.color ?? "#FFFFFF",
									color: cls?.ink ?? "#1B1A18",
								}}
							>
								{formatClassName(det.class_name)}{" "}
								{Math.round(det.confidence * 100)}%
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
