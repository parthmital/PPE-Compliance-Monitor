import { cn } from "@/lib/utils";

// Score bands used across the app: >= 80 compliant, >= 50 at risk, else critical.
const BANDS = [
	{ min: 80, label: "Compliant", text: "text-success", fill: "bg-success" },
	{ min: 50, label: "At risk", text: "text-warning", fill: "bg-warning" },
	{ min: 0, label: "Critical", text: "text-danger", fill: "bg-destructive" },
] as const;

interface ComplianceMeterProps {
	score: number;
	hasData: boolean;
}

export function ComplianceMeter({ score, hasData }: ComplianceMeterProps) {
	const band = BANDS.find((b) => score >= b.min) ?? BANDS[2];
	const clamped = Math.min(100, Math.max(0, score));

	return (
		<div className="animate-enter">
			{hasData ? (
				<div className="flex items-baseline gap-3">
					<span className="font-mono text-[44px] font-semibold leading-none tracking-tight">
						{clamped.toFixed(1)}
						<span className="ml-0.5 text-2xl text-muted-foreground">%</span>
					</span>
					<span className={cn("text-[15px] font-semibold", band.text)}>
						{band.label}
					</span>
				</div>
			) : (
				<div className="flex h-11 flex-col justify-center">
					<p className="text-[15px] font-semibold">No people detected yet</p>
					<p className="text-[13px] text-muted-foreground">
						The score appears once someone is detected in the feed or uploaded
						media.
					</p>
				</div>
			)}

			<div
				className={cn("relative mt-5", !hasData && "opacity-50")}
				role="meter"
				aria-label="Compliance score"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={hasData ? clamped : undefined}
				aria-valuetext={
					hasData ? `${clamped.toFixed(1)}%, ${band.label}` : "No data yet"
				}
			>
				<div className="h-2 overflow-hidden rounded-full bg-secondary">
					{hasData && (
						<div
							className={cn(
								"h-full rounded-full transition-[width] duration-700",
								band.fill,
							)}
							style={{ width: `${clamped}%` }}
						/>
					)}
				</div>
				{/* Band thresholds */}
				{[50, 80].map((mark) => (
					<span
						key={mark}
						aria-hidden
						className="absolute -top-1 h-4 w-px bg-foreground/40"
						style={{ left: `${mark}%` }}
					/>
				))}
				<div
					aria-hidden
					className="relative mt-2 h-4 font-mono text-[11px] text-muted-foreground"
				>
					<span className="absolute left-0">0</span>
					<span className="absolute -translate-x-1/2" style={{ left: "50%" }}>
						50
					</span>
					<span className="absolute -translate-x-1/2" style={{ left: "80%" }}>
						80
					</span>
					<span className="absolute right-0">100</span>
				</div>
			</div>
		</div>
	);
}
