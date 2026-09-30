import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePPE } from "@/contexts/PPEContext";
import { VerdictBar, VideoPlayer } from "@/components";
import { formatCount } from "@/lib";
import { Workspace } from "./Workspace";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-2">
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd className="font-mono text-[13px] font-medium">{value}</dd>
		</div>
	);
}

function eta(startTime: number | null, done: number, total: number): string {
	if (!startTime || done === 0) return "Estimating…";
	const fps = done / ((Date.now() - startTime) / 1000);
	const minutes = Math.ceil((total - done) / fps / 60);
	return minutes <= 1 ? "Under 1 min" : `About ${minutes} min`;
}

// Uploads `file` once, then shows the backend job's progress and outcome.
// With no file (after a reload) it shows the saved job state.
export function VideoResult({ file }: { file: File | null }) {
	const {
		config,
		uploadVideo,
		videoProcessing: processing,
		videoProgress: progress,
		videoFramesProcessed: framesProcessed,
		videoTotalFrames: totalFrames,
		videoAlertsFound: alerts,
	} = usePPE();
	const [startTime, setStartTime] = useState<number | null>(null);
	const started = useRef(false);
	const fileUrl = useMemo(
		() => (file ? URL.createObjectURL(file) : null),
		[file],
	);
	const confirmFrames = config.temporal_window;

	useEffect(
		() => () => {
			if (fileUrl) URL.revokeObjectURL(fileUrl);
		},
		[fileUrl],
	);

	useEffect(() => {
		if (!file || started.current) return;
		started.current = true;
		setStartTime(Date.now());
		uploadVideo(file);
	}, [file, uploadVideo]);

	const frames =
		totalFrames > 0
			? `${formatCount(framesProcessed)} / ${formatCount(totalFrames)}`
			: formatCount(framesProcessed);

	const verdict = processing ? (
		<VerdictBar
			verdict="analysing"
			title="Analysing video…"
			detail={`Frame ${frames}. Alerts appear in Incidents as they are confirmed.`}
		/>
	) : alerts > 0 ? (
		<VerdictBar
			verdict="breach"
			title={`${alerts} violation ${alerts === 1 ? "alert" : "alerts"} raised`}
			detail={
				<>
					Each alert is a missing hard hat or safety vest held for{" "}
					{confirmFrames} consecutive frames.{" "}
					<Link
						to="/incidents"
						className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4"
					>
						Review incidents
					</Link>
				</>
			}
		/>
	) : (
		<VerdictBar
			verdict="clear"
			title="No violations confirmed"
			detail={`No missing hard hat or safety vest persisted for ${confirmFrames} consecutive frames.`}
		/>
	);

	const badge = processing && (
		<span className="flex items-center gap-2 rounded-md bg-black/70 px-2 py-1 font-mono text-xs text-white">
			<span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
			Frame {frames}
		</span>
	);

	return (
		<Workspace
			aside={
				<Panel>
					<PanelHeader
						title="Progress"
						action={
							processing && (
								<span className="flex items-center gap-1.5 text-xs font-semibold text-warning">
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									Running
								</span>
							)
						}
					/>
					<div className="p-4">
						{processing && (
							<div className="mb-3">
								<div className="mb-2 flex items-baseline justify-between">
									<span className="font-mono text-2xl font-semibold">
										{progress.toFixed(0)}%
									</span>
									<span className="text-xs text-muted-foreground">
										{eta(startTime, framesProcessed, totalFrames)}
									</span>
								</div>
								<Progress
									value={progress}
									aria-label="Video analysis progress"
								/>
							</div>
						)}
						<dl className="divide-y">
							<Row label="Frames" value={frames} />
							<Row
								label="Alerts raised"
								value={
									<span className={alerts > 0 ? "text-danger" : undefined}>
										{formatCount(alerts)}
									</span>
								}
							/>
						</dl>
					</div>
				</Panel>
			}
		>
			{verdict}
			<VideoPlayer src={fileUrl} badge={badge} />
		</Workspace>
	);
}
