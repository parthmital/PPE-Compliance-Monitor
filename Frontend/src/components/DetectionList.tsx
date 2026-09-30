import { ScanSearch } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatClassName, getPPEClass, type Detection } from "@/lib/ppe-types";

type Kind = "violation" | "advisory" | "compliance" | "neutral";

const KIND: Record<
	Kind,
	{ label: string; variant: BadgeProps["variant"]; order: number }
> = {
	violation: { label: "Violation", variant: "danger", order: 0 },
	advisory: { label: "Advisory", variant: "warning", order: 1 },
	compliance: { label: "PPE worn", variant: "success", order: 2 },
	neutral: { label: "Context", variant: "outline", order: 3 },
};

interface Group {
	name: string;
	kind: Kind;
	color: string;
	confidences: number[];
}

function groupDetections(detections: Detection[]): Group[] {
	const groups = new Map<string, Group>();
	for (const det of detections) {
		const cls = getPPEClass(det.class_name);
		const group = groups.get(det.class_name) ?? {
			name: det.class_name,
			kind: det.is_violation ? "violation" : (cls?.status ?? "neutral"),
			color: cls?.color ?? "#94A3B8",
			confidences: [],
		};
		group.confidences.push(det.confidence);
		groups.set(det.class_name, group);
	}
	return [...groups.values()].sort(
		(a, b) =>
			KIND[a.kind].order - KIND[b.kind].order ||
			b.confidences.length - a.confidences.length,
	);
}

interface DetectionListProps {
	detections: Detection[];
	loading?: boolean;
}

export function DetectionList({ detections, loading }: DetectionListProps) {
	if (loading) {
		return (
			<ul aria-busy className="divide-y">
				{[0, 1, 2, 3].map((i) => (
					<li key={i} className="flex items-center gap-3 px-4 py-3.5">
						<Skeleton className="h-2.5 w-2.5" />
						<Skeleton className="h-3.5 flex-1" />
						<Skeleton className="h-3.5 w-12" />
					</li>
				))}
			</ul>
		);
	}

	if (!detections.length) {
		return (
			<EmptyState icon={ScanSearch} title="Nothing detected" className="py-10">
				Try a clearer, closer photo, or lower the confidence threshold below.
			</EmptyState>
		);
	}

	return (
		<ul className="divide-y">
			{groupDetections(detections).map((group) => {
				const kind = KIND[group.kind];
				const best = Math.max(...group.confidences);
				return (
					<li key={group.name} className="flex items-center gap-3 px-4 py-3">
						<span
							aria-hidden
							className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
							style={{ backgroundColor: group.color }}
						/>
						<span className="min-w-0 flex-1 truncate font-medium">
							{formatClassName(group.name)}
							{group.confidences.length > 1 && (
								<span className="ml-1.5 font-mono text-xs text-muted-foreground">
									×{group.confidences.length}
								</span>
							)}
						</span>
						<Badge variant={kind.variant}>{kind.label}</Badge>
						<span
							className="w-10 text-right font-mono text-xs text-muted-foreground"
							aria-label={`Highest confidence ${Math.round(best * 100)} percent`}
						>
							{Math.round(best * 100)}%
						</span>
					</li>
				);
			})}
		</ul>
	);
}
