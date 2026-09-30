import { useState } from "react";
import { ImageOff } from "lucide-react";
import { getIncidentImageUrl, type Incident } from "@/lib";
import { cn } from "@/lib/utils";

interface IncidentThumbProps {
	incident: Incident;
	className?: string;
	fit?: "cover" | "contain";
}

export function IncidentThumb({
	incident,
	className,
	fit = "cover",
}: IncidentThumbProps) {
	const [failed, setFailed] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const url = getIncidentImageUrl(incident.image_path);

	return (
		<div
			className={cn(
				"flex items-center justify-center overflow-hidden bg-neutral-950",
				className,
			)}
		>
			{url && !failed ? (
				<img
					src={url}
					alt={`Captured frame: ${incident.missing_ppe.join(", ")}`}
					loading="lazy"
					onError={() => setFailed(true)}
					onLoad={() => setLoaded(true)}
					data-loaded={loaded}
					className={cn(
						"img-fade h-full w-full",
						fit === "cover" ? "object-cover" : "object-contain",
					)}
				/>
			) : (
				<ImageOff
					className="h-5 w-5 text-neutral-500"
					aria-label="Image unavailable"
				/>
			)}
		</div>
	);
}
