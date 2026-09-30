import { cn } from "@/lib/utils";

interface StatProps {
	label: string;
	value: React.ReactNode;
	hint?: string;
	tone?: "default" | "danger";
	className?: string;
}

// A labelled figure. Laid out in grids separated by rules, not as cards.
export function Stat({
	label,
	value,
	hint,
	tone = "default",
	className,
}: StatProps) {
	return (
		<div className={cn("min-w-0 px-4 py-4 sm:px-5", className)}>
			<dt className="label-caps truncate">{label}</dt>
			<dd
				className={cn(
					"mt-2 font-mono text-2xl font-semibold leading-none tracking-tight",
					tone === "danger" && "text-danger",
				)}
			>
				{value}
			</dd>
			{hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
		</div>
	);
}
