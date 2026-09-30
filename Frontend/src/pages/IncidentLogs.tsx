import { useState } from "react";
import { Link } from "react-router-dom";
import {
	Download,
	LayoutGrid,
	List,
	ScanSearch,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePPE } from "@/contexts/PPEContext";
import {
	EmptyState,
	IncidentThumb,
	IncidentViewer,
	MissingPPE,
	PageHeader,
	SegmentedControl,
} from "@/components";
import { formatCount, formatTimestamp, type Incident } from "@/lib";
import { exportIncidentsToCSV, incidentSource } from "@/lib/incidents";

type View = "list" | "grid";

function IncidentTable({
	incidents,
	onOpen,
}: {
	incidents: Incident[];
	onOpen: (index: number) => void;
}) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-[104px] sm:w-[120px]">Snapshot</TableHead>
					<TableHead>Time</TableHead>
					<TableHead>Missing PPE</TableHead>
					<TableHead className="hidden md:table-cell">Source</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{incidents.map((incident, index) => {
					const { date, time } = formatTimestamp(incident.timestamp);
					const source = incidentSource(incident);
					return (
						<TableRow
							key={incident.id}
							onClick={() => onOpen(index)}
							className="cursor-pointer hover:bg-accent/60"
						>
							<TableCell className="py-2.5">
								<button
									type="button"
									aria-label={`Open incident at ${time}, ${date}`}
									onClick={(e) => {
										e.stopPropagation();
										onOpen(index);
									}}
									className="block rounded-md"
								>
									<IncidentThumb
										incident={incident}
										className="h-10 w-16 rounded-md sm:h-12 sm:w-20"
									/>
								</button>
							</TableCell>
							<TableCell>
								<p className="font-mono text-[13px] font-medium">{time}</p>
								<p className="whitespace-nowrap text-xs text-muted-foreground">
									{date}
								</p>
							</TableCell>
							<TableCell>
								<MissingPPE items={incident.missing_ppe} />
							</TableCell>
							<TableCell className="hidden max-w-[260px] md:table-cell">
								<p className="text-[13px]">{source.kind}</p>
								{source.file && (
									<p className="truncate font-mono text-xs text-muted-foreground">
										{source.file}
									</p>
								)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}

function IncidentGrid({
	incidents,
	onOpen,
}: {
	incidents: Incident[];
	onOpen: (index: number) => void;
}) {
	return (
		<ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
			{incidents.map((incident, index) => {
				const { date, time } = formatTimestamp(incident.timestamp);
				return (
					<li key={incident.id}>
						<button
							type="button"
							onClick={() => onOpen(index)}
							aria-label={`Open incident at ${time}, ${date}`}
							className="group block w-full overflow-hidden rounded-md border bg-card text-left transition-colors hover:border-foreground/30"
						>
							<IncidentThumb
								incident={incident}
								className="aspect-video w-full"
							/>
							<div className="space-y-2 p-3">
								<p className="text-[13px]">
									<span className="font-mono font-medium">{time}</span>
									<span className="text-muted-foreground"> · {date}</span>
								</p>
								<MissingPPE items={incident.missing_ppe} />
							</div>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

function LoadingRows() {
	return (
		<div aria-busy className="divide-y">
			{[0, 1, 2, 3].map((i) => (
				<div key={i} className="flex items-center gap-6 px-4 py-3">
					<Skeleton className="h-12 w-20" />
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-32" />
				</div>
			))}
		</div>
	);
}

export default function IncidentLogs() {
	const { incidents, clearAllIncidents, connection } = usePPE();
	const [view, setView] = useState<View>("list");
	const [viewing, setViewing] = useState<number | null>(null);
	const hasIncidents = incidents.length > 0;

	const body =
		connection === "connecting" && !hasIncidents ? (
			<LoadingRows />
		) : !hasIncidents ? (
			<EmptyState
				icon={ShieldCheck}
				title="No incidents recorded"
				className="py-16"
				action={
					<Button asChild variant="secondary">
						<Link to="/detection">
							<ScanSearch />
							Analyse media
						</Link>
					</Button>
				}
			>
				When an analysed photo or video shows a missing hard hat or safety vest,
				the captured frame is logged here.
			</EmptyState>
		) : view === "list" ? (
			<IncidentTable incidents={incidents} onOpen={setViewing} />
		) : (
			<IncidentGrid incidents={incidents} onOpen={setViewing} />
		);

	return (
		<>
			<PageHeader
				title="Incidents"
				description={
					hasIncidents
						? `${formatCount(incidents.length)} confirmed ${incidents.length === 1 ? "violation" : "violations"}, newest first.`
						: "Confirmed PPE violations with the captured frame."
				}
				actions={
					<>
						{hasIncidents && (
							<SegmentedControl<View>
								label="Layout"
								value={view}
								onChange={setView}
								options={[
									{ value: "list", label: "List", icon: List },
									{ value: "grid", label: "Grid", icon: LayoutGrid },
								]}
							/>
						)}
						<Button
							variant="secondary"
							disabled={!hasIncidents}
							onClick={() => exportIncidentsToCSV(incidents)}
						>
							<Download />
							Export CSV
						</Button>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive-ghost" disabled={!hasIncidents}>
									<Trash2 />
									Clear all
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete all incidents?</AlertDialogTitle>
									<AlertDialogDescription>
										This permanently deletes {formatCount(incidents.length)}{" "}
										incident {incidents.length === 1 ? "record" : "records"} and
										their captured frames. Export a CSV first if you need a
										copy.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Keep incidents</AlertDialogCancel>
									<AlertDialogAction onClick={clearAllIncidents}>
										Delete all
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</>
				}
			/>

			<Panel className="overflow-hidden">{body}</Panel>

			<IncidentViewer
				incidents={incidents}
				index={viewing}
				onIndexChange={setViewing}
			/>
		</>
	);
}
