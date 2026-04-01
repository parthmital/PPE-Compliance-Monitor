import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SafetyScoreBadgeProps {
	score: number;
	className?: string;
}

type ScoreTier = "high" | "medium" | "low";

const SCORE_CONFIG: Record<
	ScoreTier,
	{ bg: string; text: string; glow: string; border: string; min: number }
> = {
	high: {
		min: 80,
		bg: "bg-safety-green/10",
		text: "text-safety-green",
		glow: "glow-green",
		border: "border-safety-green/30",
	},
	medium: {
		min: 50,
		bg: "bg-safety-orange/10",
		text: "text-safety-orange",
		glow: "glow-orange",
		border: "border-safety-orange/30",
	},
	low: {
		min: 0,
		bg: "bg-safety-red/10",
		text: "text-safety-red",
		glow: "glow-red",
		border: "border-safety-red/30",
	},
};

function getScoreTier(score: number): ScoreTier {
	if (score >= 80) return "high";
	if (score >= 50) return "medium";
	return "low";
}

export function SafetyScoreBadge({
	score,
	className = "",
}: SafetyScoreBadgeProps) {
	const tier = getScoreTier(score);
	const colors = SCORE_CONFIG[tier];

	return (
		<motion.div
			initial={{ scale: 0.8, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", stiffness: 200 }}
			className={cn(
				"relative flex flex-col items-center justify-center rounded-2xl border p-8",
				colors.border,
				colors.bg,
				colors.glow,
				className,
			)}
		>
			<span className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
				Safety Score
			</span>
			<span className={cn("text-7xl font-extrabold font-mono", colors.text)}>
				{score}
			</span>
			<span className={cn("text-lg font-semibold", colors.text)}>%</span>
		</motion.div>
	);
}
