import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<SidebarProvider>
			<div className="h-screen flex w-full overflow-hidden">
				<AppSidebar />
				<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
					<header className="h-12 flex items-center justify-between border-b bg-background px-4 shrink-0 gap-2">
						<div className="flex items-center gap-2">
							<SidebarTrigger className="md:hidden" />
							<span className="text-sm font-semibold md:hidden">
								PPE Monitor
							</span>
							<span className="hidden md:block text-sm font-semibold">
								PPE Compliance Monitor
							</span>
						</div>
						<div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
							<span>Real-time Safety Detection</span>
						</div>
					</header>
					<main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
				</div>
			</div>
		</SidebarProvider>
	);
}
