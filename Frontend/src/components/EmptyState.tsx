import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	children?: React.ReactNode;
	action?: React.ReactNode;
	className?: string;
}

export function EmptyState({
	icon: Icon,
	title,
	children,
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center px-6 py-12 text-center",
				className,
			)}
		>
			<span className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border bg-background text-muted-foreground">
				<Icon className="h-5 w-5" />
			</span>
			<p className="text-[15px] font-semibold">{title}</p>
			{children && (
				<p className="mt-1 max-w-sm text-sm text-muted-foreground">
					{children}
				</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}
