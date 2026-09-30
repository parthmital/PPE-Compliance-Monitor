import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type Verdict = "analysing" | "clear" | "breach";

const VERDICT_STYLE: Record<
	Verdict,
	{ icon: typeof ShieldCheck; className: string; iconClass: string }
> = {
	analysing: {
		icon: Loader2,
		className: "border-warning/35 bg-warning/10",
		iconClass: "animate-spin text-warning",
	},
	clear: {
		icon: ShieldCheck,
		className: "border-success/35 bg-success/10",
		iconClass: "text-success",
	},
	breach: {
		icon: ShieldAlert,
		className: "border-destructive/40 bg-destructive/10",
		iconClass: "text-danger",
	},
};

interface VerdictBarProps {
	verdict: Verdict;
	title: string;
	detail?: React.ReactNode;
}

// One-line outcome of an analysis, shown above the media.
export function VerdictBar({ verdict, title, detail }: VerdictBarProps) {
	const { icon: Icon, className, iconClass } = VERDICT_STYLE[verdict];
	return (
		<div
			key={verdict}
			role="status"
			aria-live="polite"
			className={cn(
				"animate-enter flex items-start gap-3 rounded-lg border px-4 py-3",
				className,
			)}
		>
			<Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconClass)} />
			<div className="min-w-0">
				<p className="text-[15px] font-semibold leading-snug">{title}</p>
				{detail && (
					<p className="mt-0.5 text-[13px] text-muted-foreground">{detail}</p>
				)}
			</div>
		</div>
	);
}
