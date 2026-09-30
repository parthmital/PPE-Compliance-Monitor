import { DetectionSettings } from "@/components";

// Main column plus a right-hand column that always ends with the settings.
export function Workspace({
	children,
	aside,
}: {
	children: React.ReactNode;
	aside?: React.ReactNode;
}) {
	return (
		<div className="animate-enter grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
			<div className="min-w-0 space-y-4">{children}</div>
			<aside className="space-y-4">
				{aside}
				<DetectionSettings />
			</aside>
		</div>
	);
}
