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
import { usePPE } from "@/contexts/PPEContext";
import {
	SafetyScoreBadge,
	MetricCard,
	SmallMetric,
	ClassLegend,
} from "@/components";

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
							highlightColor={metrics.alerts_per_hour > 5 ? "red" : "default"}
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
