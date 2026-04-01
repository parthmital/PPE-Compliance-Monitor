import { motion } from "framer-motion";
import {
	ShieldCheck,
	Target,
	AlertTriangle,
	XCircle,
	Layers,
	Film,
	Bell,
	Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PPE_CLASSES } from "@/lib/ppe-types";
import { usePPE } from "@/contexts/PPEContext";

function SafetyScoreBadge({ score }: { score: number }) {
	const getScoreColor = () => {
		if (score >= 80)
			return {
				bg: "bg-safety-green/10",
				text: "text-safety-green",
				glow: "glow-green",
				border: "border-safety-green/30",
			};
		if (score >= 50)
			return {
				bg: "bg-safety-orange/10",
				text: "text-safety-orange",
				glow: "glow-orange",
				border: "border-safety-orange/30",
			};
		return {
			bg: "bg-safety-red/10",
			text: "text-safety-red",
			glow: "glow-red",
			border: "border-safety-red/30",
		};
	};
	const colors = getScoreColor();

	return (
		<motion.div
			initial={{ scale: 0.8, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", stiffness: 200 }}
			className={`relative flex flex-col items-center justify-center rounded-2xl border ${colors.border} ${colors.bg} ${colors.glow} p-8`}
		>
			<span className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
				Safety Score
			</span>
			<span className={`text-7xl font-extrabold font-mono ${colors.text}`}>
				{score}
			</span>
			<span className={`text-lg font-semibold ${colors.text}`}>%</span>
		</motion.div>
	);
}

function MetricCard({
	title,
	value,
	subtitle,
	icon: Icon,
	highlight,
	delay = 0,
}: {
	title: string;
	value: string | number;
	subtitle?: string;
	icon: React.ElementType;
	highlight?: boolean;
	delay?: number;
}) {
	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ delay, duration: 0.3 }}
		>
			<Card className={highlight ? "border-safety-red/30 bg-safety-red/5" : ""}>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						{title}
					</CardTitle>
					<Icon
						className={`h-4 w-4 ${highlight ? "text-safety-red" : "text-muted-foreground"}`}
					/>
				</CardHeader>
				<CardContent>
					<div
						className={`text-2xl font-bold font-mono ${highlight ? "text-safety-red" : "text-foreground"}`}
					>
						{value}
					</div>
					{subtitle && (
						<p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
					)}
				</CardContent>
			</Card>
		</motion.div>
	);
}

function SmallMetric({
	label,
	value,
	delay,
}: {
	label: string;
	value: string | number;
	delay: number;
}) {
	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ delay, duration: 0.3 }}
		>
			<Card>
				<CardContent className="pt-4 pb-3 px-4 text-center">
					<p className="text-xl font-bold font-mono text-foreground">{value}</p>
					<p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">
						{label}
					</p>
				</CardContent>
			</Card>
		</motion.div>
	);
}

function ClassLegend() {
	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ delay: 0.4, duration: 0.3 }}
		>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-medium">
						Detection Classes
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-2">
						{PPE_CLASSES.map((cls) => (
							<div key={cls.name} className="flex items-center gap-2 text-xs">
								<div
									className="h-3 w-3 rounded-full shrink-0"
									style={{ backgroundColor: cls.color }}
								/>
								<span className="text-foreground">{cls.name}</span>
								<span className="ml-auto">{cls.emoji}</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

export default function Dashboard() {
	const { metrics } = usePPE();

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Dashboard</h1>
				<p className="text-sm text-muted-foreground">
					Real-time PPE compliance overview
				</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Safety Score - spans 1 col */}
				<SafetyScoreBadge score={metrics.safety_score} />

				{/* Main metrics - spans 3 cols */}
				<div className="lg:col-span-3 space-y-4">
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<MetricCard
							title="Detection Accuracy"
							value={metrics.detection_accuracy.toFixed(2)}
							subtitle="mAP@0.5"
							icon={Target}
							delay={0.1}
						/>
						<MetricCard
							title="Alerts / Hour"
							value={metrics.alerts_per_hour.toFixed(1)}
							icon={AlertTriangle}
							highlight={metrics.alerts_per_hour > 5}
							delay={0.15}
						/>
						<MetricCard
							title="False Alarm Rate"
							value={`${metrics.false_alarm_rate.toFixed(1)}%`}
							icon={XCircle}
							delay={0.2}
						/>
					</div>

					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<SmallMetric
							label="Frames Processed"
							value={metrics.frames_processed.toLocaleString()}
							delay={0.25}
						/>
						<SmallMetric
							label="Violation Frames"
							value={metrics.violation_frames}
							delay={0.3}
						/>
						<SmallMetric
							label="Confirmed Alerts"
							value={metrics.confirmed_alerts}
							delay={0.35}
						/>
						<SmallMetric
							label="Persons Detected"
							value={metrics.persons_detected}
							delay={0.4}
						/>
					</div>
				</div>
			</div>

			{/* Class Legend */}
			<ClassLegend />
		</div>
	);
}
