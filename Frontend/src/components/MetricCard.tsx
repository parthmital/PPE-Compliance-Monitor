import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type HighlightColor = "default" | "red" | "orange" | "green";

interface MetricCardProps {
	title: string;
	value: string | number;
	subtitle?: string;
	icon: React.ElementType;
	highlight?: boolean;
	highlightColor?: HighlightColor;
	delay?: number;
}

const HIGHLIGHT_STYLES: Record<HighlightColor, { card: string; text: string }> =
	{
		default: { card: "", text: "" },
		red: {
			card: "border-safety-red/30 bg-safety-red/5",
			text: "text-safety-red",
		},
		orange: {
			card: "border-safety-orange/30 bg-safety-orange/5",
			text: "text-safety-orange",
		},
		green: {
			card: "border-safety-green/30 bg-safety-green/5",
			text: "text-safety-green",
		},
	};

export function MetricCard({
	title,
	value,
	subtitle,
	icon: Icon,
	highlight = false,
	highlightColor = "red",
	delay = 0,
}: MetricCardProps) {
	const styles = highlight
		? HIGHLIGHT_STYLES[highlightColor]
		: HIGHLIGHT_STYLES.default;

	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ delay, duration: 0.3 }}
		>
			<Card className={styles.card}>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						{title}
					</CardTitle>
					<Icon
						className={`h-4 w-4 ${highlight ? styles.text : "text-muted-foreground"}`}
					/>
				</CardHeader>
				<CardContent>
					<div
						className={`text-2xl font-bold font-mono ${highlight ? styles.text : "text-foreground"}`}
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

interface SmallMetricProps {
	label: string;
	value: string | number;
	delay?: number;
}

export function SmallMetric({ label, value, delay = 0 }: SmallMetricProps) {
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
