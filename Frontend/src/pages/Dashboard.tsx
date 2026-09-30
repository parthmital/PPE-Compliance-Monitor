import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ScanSearch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePPE } from "@/contexts/PPEContext";
import {
	ComplianceMeter,
	EmptyState,
	IncidentThumb,
	IncidentViewer,
	MissingPPE,
	PageHeader,
	Stat,
} from "@/components";
import { formatCount, formatTimestamp } from "@/lib";
import { incidentSource } from "@/lib/incidents";

const RECENT_LIMIT = 5;

function RecentIncidents() {
	const { incidents, connection } = usePPE();
	const [viewing, setViewing] = useState<number | null>(null);
	const recent = incidents.slice(0, RECENT_LIMIT);

	if (connection === "connecting") {
		return (
			<ul aria-busy className="divide-y">
				{[0, 1, 2].map((i) => (
					<li key={i} className="flex items-center gap-4 px-4 py-3">
						<Skeleton className="h-12 w-20" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-3.5 w-32" />
							<Skeleton className="h-3.5 w-24" />
						</div>
					</li>
				))}
			</ul>
		);
	}

	if (!recent.length) {
		return (
			<EmptyState icon={ShieldCheck} title="No incidents yet">
				Violations found in analysed photos and videos will appear here.
			</EmptyState>
		);
	}

	return (
		<>
			<ul className="divide-y">
				{recent.map((incident, index) => {
					const { date, time } = formatTimestamp(incident.timestamp);
					return (
						<li key={incident.id}>
							<button
								type="button"
								onClick={() => setViewing(index)}
								className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent/60"
							>
								<IncidentThumb
									incident={incident}
									className="h-12 w-20 shrink-0 rounded-md"
								/>
								<div className="min-w-0 flex-1 space-y-1.5">
									<p className="text-[13px]">
										<span className="font-mono font-medium">{time}</span>
										<span className="text-muted-foreground"> · {date}</span>
									</p>
									<MissingPPE items={incident.missing_ppe} />
								</div>
								<span className="hidden shrink-0 text-[13px] text-muted-foreground sm:block">
									{incidentSource(incident).kind}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
			<IncidentViewer
				incidents={recent}
				index={viewing}
				onIndexChange={setViewing}
			/>
		</>
	);
}

export default function Dashboard() {
	const { metrics, incidents, connection } = usePPE();
	const loading = connection === "connecting";
	const hasData = metrics.persons_detected > 0;
	const show = (value: string) => (loading ? "—" : value);

	return (
		<>
			<PageHeader
				title="Overview"
				description="PPE compliance across all analysed photos and videos."
				actions={
					<Button asChild>
						<Link to="/detection">
							<ScanSearch />
							Analyse media
						</Link>
					</Button>
				}
			/>

			<div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
				<Panel>
					<PanelHeader title="Site compliance" />
					<div className="p-5">
						{loading ? (
							<div aria-busy className="space-y-5">
								<Skeleton className="h-11 w-40" />
								<Skeleton className="h-2 w-full" />
							</div>
						) : (
							<ComplianceMeter score={metrics.safety_score} hasData={hasData} />
						)}
						<p className="mt-4 text-[13px] text-muted-foreground">
							Share of detected people wearing both a hard hat and a safety
							vest.
						</p>
					</div>
				</Panel>

				<Panel className="overflow-hidden">
					<PanelHeader title="Detection activity" />
					<dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 [&>div]:bg-card">
						<Stat
							label="Confirmed alerts"
							value={show(formatCount(metrics.confirmed_alerts))}
							tone={metrics.confirmed_alerts > 0 ? "danger" : "default"}
						/>
						<Stat
							label="Alerts per hour"
							value={show(metrics.alerts_per_hour.toFixed(1))}
						/>
						<Stat
							label="Violation frames"
							value={show(formatCount(metrics.violation_frames))}
						/>
						<Stat
							label="False alarm rate"
							value={show(`${metrics.false_alarm_rate.toFixed(1)}%`)}
						/>
						<Stat
							label="Frames processed"
							value={show(formatCount(metrics.frames_processed))}
						/>
						<Stat
							label="People detected"
							value={show(formatCount(metrics.persons_detected))}
						/>
					</dl>
				</Panel>
			</div>

			<Panel className="mt-4">
				<PanelHeader
					title="Recent incidents"
					action={
						incidents.length > 0 && (
							<Button asChild variant="ghost" size="sm" className="-mr-2">
								<Link to="/incidents">
									View all {formatCount(incidents.length)}
									<ArrowRight />
								</Link>
							</Button>
						)
					}
				/>
				<RecentIncidents />
			</Panel>
		</>
	);
}
