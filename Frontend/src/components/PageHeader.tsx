interface PageHeaderProps {
	title: string;
	description?: React.ReactNode;
	actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		<header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
			<div className="min-w-0">
				<h1 className="text-[26px] leading-tight">{title}</h1>
				{description && (
					<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			{actions && (
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{actions}
				</div>
			)}
		</header>
	);
}
