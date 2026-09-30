import { FileImage } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/card";
import {
	DetectionList,
	EmptyState,
	ImagePreview,
	VerdictBar,
} from "@/components";
import { formatClassName, type Detection } from "@/lib";
import { Workspace } from "./Workspace";

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

export function ImageResult({
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
