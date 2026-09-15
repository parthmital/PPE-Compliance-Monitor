import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";

type AlertLevel = "clear" | "potential" | "confirmed";

interface AlertBannerProps {
	level: AlertLevel;
	message?: string;
}

const ALERT_CONFIG = {
	clear: {
		icon: ShieldCheck,
		message: "All Clear — Full PPE Compliance",
		className: "bg-safety-green/10 border-safety-green/30 text-safety-green",
	},
	potential: {
		icon: AlertTriangle,
		message: "Potential Violation — Confirming...",
		className: "bg-safety-orange/10 border-safety-orange/30 text-safety-orange",
	},
	confirmed: {
		icon: ShieldAlert,
		message: "CONFIRMED BREACH — Missing PPE Detected",
		className:
			"bg-safety-red/10 border-safety-red/30 text-safety-red animate-pulse-glow",
	},
};

export function AlertBanner({ level, message }: AlertBannerProps) {
	const config = ALERT_CONFIG[level];
	const Icon = config.icon;

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${config.className}`}
		>
			<Icon className="h-5 w-5" />
			<span className="text-sm font-medium">{message || config.message}</span>
		</motion.div>
	);
}

export type { AlertLevel };
