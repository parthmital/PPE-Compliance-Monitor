import { formatTimestamp, type Incident } from "@/lib";
import { cn } from "@/lib/utils";
import { MissingPPE } from "./MissingPPE";

// Time, date and missing PPE for an incident card or row.
export function IncidentSummary({
	incident,
	className,
}: {
	incident: Incident;
	className?: string;
}) {
	const { date, time } = formatTimestamp(incident.timestamp);
	return (
		<div className={cn("min-w-0", className)}>
			<p className="text-[13px]">
				<span className="font-mono font-medium">{time}</span>
				<span className="text-muted-foreground"> · {date}</span>
			</p>
			<MissingPPE items={incident.missing_ppe} />
		</div>
	);
}
