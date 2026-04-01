import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<SidebarProvider>
			<div className="h-screen flex w-full overflow-hidden">
				<AppSidebar />
				<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
					<header className="h-12 flex items-center border-b px-4 shrink-0">
						{/* Sidebar toggle removed for always-visible desktop view */}
					</header>
					<main className="flex-1 p-6 overflow-auto">{children}</main>
				</div>
			</div>
		</SidebarProvider>
	);
}
