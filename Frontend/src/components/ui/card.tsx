import * as React from "react";

import { cn } from "@/lib/utils";

// A bordered surface for one framed tool or section. Never nest panels.
const Panel = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
	({ className, ...props }, ref) => (
		<section
			ref={ref}
			className={cn(
				"rounded-lg border bg-card text-card-foreground",
				className,
			)}
			{...props}
		/>
	),
);
Panel.displayName = "Panel";

interface PanelHeaderProps extends Omit<
	React.HTMLAttributes<HTMLDivElement>,
	"title"
> {
	title: React.ReactNode;
	action?: React.ReactNode;
}

function PanelHeader({ title, action, className, ...props }: PanelHeaderProps) {
	return (
		<div
			className={cn(
				"flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2",
				className,
			)}
			{...props}
		>
			<h2 className="label-caps">{title}</h2>
			{action}
		</div>
	);
}

export { Panel, PanelHeader };
