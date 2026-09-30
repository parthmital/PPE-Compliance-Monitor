import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { WithTooltip } from "@/components/ui/tooltip";
import { IncidentThumb } from "@/components/IncidentThumb";
import { MissingPPE } from "@/components/MissingPPE";
import { formatTimestamp, type Incident } from "@/lib";
import { incidentSource } from "@/lib/incidents";

interface IncidentViewerProps {
	incidents: Incident[];
	index: number | null;
	onIndexChange: (index: number | null) => void;
}

// Full-size view of one captured frame, with previous/next navigation.
export function IncidentViewer({
	incidents,
	index,
	onIndexChange,
}: IncidentViewerProps) {
	const incident = index != null ? incidents[index] : null;
	const hasPrev = index != null && index > 0;
	const hasNext = index != null && index < incidents.length - 1;

	const go = (step: number) => {
		if (index == null) return;
		const next = index + step;
		if (next >= 0 && next < incidents.length) onIndexChange(next);
	};

	const { date, time } = incident
		? formatTimestamp(incident.timestamp)
		: { date: "", time: "" };
	const source = incident ? incidentSource(incident) : null;

	return (
		<Dialog
			open={!!incident}
			onOpenChange={(open) => !open && onIndexChange(null)}
		>
			<DialogContent
				// Focus the dialog itself so no control (or its tooltip) is pre-selected.
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					(e.currentTarget as HTMLElement).focus();
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowLeft") go(-1);
					if (e.key === "ArrowRight") go(1);
				}}
			>
				{incident && (
					<>
						<div className="border-b px-5 py-4 pr-14">
							<DialogTitle className="text-base font-semibold">
								Incident at {time}
								<span className="font-normal text-muted-foreground">
									{" "}
									· {date}
								</span>
							</DialogTitle>
							<DialogDescription className="sr-only">
								Captured frame with missing PPE outlined. Use the arrow keys to
								move between incidents.
							</DialogDescription>
						</div>

						<IncidentThumb
							incident={incident}
							fit="contain"
							className="min-h-[240px] flex-1 [&_img]:max-h-[64vh]"
						/>

						<div className="flex flex-col gap-4 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="min-w-0 space-y-2">
								<MissingPPE items={incident.missing_ppe} />
								<p className="truncate text-[13px] text-muted-foreground">
									{source?.kind}
									{source?.file && (
										<span className="font-mono text-xs"> · {source.file}</span>
									)}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<span className="mr-1 font-mono text-xs text-muted-foreground">
									{(index ?? 0) + 1} / {incidents.length}
								</span>
								<WithTooltip label="Previous incident">
									<Button
										variant="secondary"
										size="icon-sm"
										aria-label="Previous incident"
										disabled={!hasPrev}
										onClick={() => go(-1)}
									>
										<ChevronLeft />
									</Button>
								</WithTooltip>
								<WithTooltip label="Next incident">
									<Button
										variant="secondary"
										size="icon-sm"
										aria-label="Next incident"
										disabled={!hasNext}
										onClick={() => go(1)}
									>
										<ChevronRight />
									</Button>
								</WithTooltip>
							</div>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
