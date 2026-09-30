import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
	Gauge,
	HardHat,
	Moon,
	ScanSearch,
	Sun,
	TriangleAlert,
	WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { usePPE, type ConnectionState } from "@/contexts/PPEContext";
import { API_BASE } from "@/lib";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
	{ to: "/", label: "Overview", icon: Gauge, end: true },
	{ to: "/detection", label: "Analyse", icon: ScanSearch, end: false },
	{ to: "/incidents", label: "Incidents", icon: TriangleAlert, end: false },
] as const;

const CONNECTION_COPY: Record<
	ConnectionState,
	{ label: string; tone: string }
> = {
	connecting: { label: "Connecting", tone: "bg-warning" },
	online: { label: "Online", tone: "bg-success" },
	offline: { label: "Offline", tone: "bg-destructive" },
};

function Brand() {
	return (
		<div className="flex items-center gap-2.5">
			<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
				<HardHat className="h-[18px] w-[18px]" strokeWidth={2.25} />
			</span>
			<span className="leading-tight">
				<span className="block text-[15px] font-bold tracking-tight">
					PPE Compliance Monitor
				</span>
				<span className="block text-xs text-muted-foreground">
					Construction site safety
				</span>
			</span>
		</div>
	);
}

function Dot({ className }: { className: string }) {
	return (
		<span
			aria-hidden
			className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
		/>
	);
}

function ThemeToggle({ compact = false }: { compact?: boolean }) {
	const { isDarkMode, toggleDarkMode } = usePPE();
	const Icon = isDarkMode ? Sun : Moon;
	const label = isDarkMode ? "Switch to light theme" : "Switch to dark theme";

	if (compact) {
		return (
			<WithTooltip label={label} side="bottom">
				<Button
					variant="ghost"
					size="icon"
					aria-label={label}
					onClick={toggleDarkMode}
				>
					<Icon
						key={label}
						className="animate-in fade-in-0 spin-in-45 duration-200"
					/>
				</Button>
			</WithTooltip>
		);
	}
	return (
		<Button
			variant="ghost"
			size="sm"
			className="w-full justify-start"
			onClick={toggleDarkMode}
		>
			<Icon
				key={label}
				className="animate-in fade-in-0 spin-in-45 duration-200"
			/>
			{isDarkMode ? "Light theme" : "Dark theme"}
		</Button>
	);
}

function SystemStatus() {
	const { connection, config } = usePPE();
	const server = CONNECTION_COPY[connection];
	const modelReady = connection === "online" && config.model_loaded;

	return (
		<dl className="space-y-2 px-1 text-[13px]">
			<div className="flex items-center justify-between gap-3">
				<dt className="text-muted-foreground">Server</dt>
				<dd className="flex items-center gap-2 font-medium">
					<Dot className={server.tone} />
					{server.label}
				</dd>
			</div>
			<div className="flex items-center justify-between gap-3">
				<dt className="text-muted-foreground">Model</dt>
				<dd className="flex min-w-0 items-center gap-2 font-medium">
					<Dot
						className={modelReady ? "bg-success" : "bg-muted-foreground/50"}
					/>
					<span className="truncate font-mono text-xs">
						{modelReady ? config.model_name || "Loaded" : "Not loaded"}
					</span>
				</dd>
			</div>
		</dl>
	);
}

function IncidentCount() {
	const { incidents } = usePPE();
	if (!incidents.length) return null;
	return (
		<span className="ml-auto rounded-sm bg-destructive/15 px-1.5 font-mono text-[11px] font-semibold leading-5 text-danger">
			{incidents.length > 99 ? "99+" : incidents.length}
		</span>
	);
}

function Sidebar() {
	return (
		<aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card lg:flex">
			<div className="flex h-16 items-center border-b px-5">
				<Brand />
			</div>
			<nav aria-label="Main" className="space-y-0.5 p-3">
				{NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
					<NavLink
						key={to}
						to={to}
						end={end}
						className={({ isActive }) =>
							cn(
								"relative flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors",
								isActive
									? "bg-accent text-foreground before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
									: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
							)
						}
					>
						<Icon className="h-4 w-4" />
						{label}
						{to === "/incidents" && <IncidentCount />}
					</NavLink>
				))}
			</nav>
			<div className="mt-auto space-y-3 border-t p-3 pt-4">
				<SystemStatus />
				<ThemeToggle />
			</div>
		</aside>
	);
}

function MobileBar() {
	const { connection } = usePPE();
	const server = CONNECTION_COPY[connection];

	return (
		<header className="sticky top-0 z-30 border-b bg-card lg:hidden">
			<div className="flex h-14 items-center justify-between px-4">
				<Brand />
				<div className="flex items-center gap-1">
					<span className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
						<Dot className={server.tone} />
						{server.label}
					</span>
					<ThemeToggle compact />
				</div>
			</div>
			<nav aria-label="Main" className="grid grid-cols-3 border-t">
				{NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
					<NavLink
						key={to}
						to={to}
						end={end}
						className={({ isActive }) =>
							cn(
								"relative flex h-11 items-center justify-center gap-2 text-[13px] font-semibold transition-colors",
								isActive
									? "text-foreground after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-primary"
									: "text-muted-foreground hover:text-foreground",
							)
						}
					>
						<Icon className="h-4 w-4" />
						{label}
					</NavLink>
				))}
			</nav>
		</header>
	);
}

function OfflineNotice() {
	return (
		<div
			role="status"
			className="flex items-start gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] sm:px-6 lg:px-10"
		>
			<WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
			<p>
				<span className="font-semibold">Can't reach the detection server</span>{" "}
				<span className="text-muted-foreground">
					at <span className="font-mono text-xs">{API_BASE}</span>. Check that
					the backend is running. This page reconnects automatically.
				</span>
			</p>
		</div>
	);
}

export function AppLayout({ children }: { children: React.ReactNode }) {
	const { connection } = usePPE();
	const { pathname } = useLocation();

	// New page starts at the top; jump rather than animate the scroll.
	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "instant" });
	}, [pathname]);

	return (
		<div className="min-h-dvh lg:flex">
			<Sidebar />
			<div className="min-w-0 flex-1">
				<MobileBar />
				{connection === "offline" && <OfflineNotice />}
				<main
					key={pathname}
					className="animate-enter mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8"
				>
					{children}
				</main>
			</div>
		</div>
	);
}
