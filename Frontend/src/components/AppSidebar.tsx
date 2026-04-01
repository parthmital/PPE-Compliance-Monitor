import {
	LayoutDashboard,
	ScanEye,
	FileWarning,
	Moon,
	Sun,
	Shield,
	RotateCcw,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarFooter,
	useSidebar,
} from "@/components/ui/sidebar";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { usePPE } from "@/contexts/PPEContext";
import { FileUploadButton } from "./FileUploadButton";

const navItems = [
	{ title: "Dashboard", url: "/", icon: LayoutDashboard },
	{ title: "Real-time Detection", url: "/detection", icon: ScanEye },
	{ title: "Incident Logs", url: "/incidents", icon: FileWarning },
];

export function AppSidebar() {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";
	const location = useLocation();
	const {
		config,
		setConfig,
		sessionStart,
		isDarkMode,
		toggleDarkMode,
		uploadModel,
	} = usePPE();

	return (
		<Sidebar collapsible="offcanvas">
			<SidebarContent>
				{/* Logo */}
				<SidebarGroup>
					<SidebarGroupContent>
						<div className="flex items-center gap-2 px-2 py-3">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
								<Shield className="h-4 w-4 text-primary-foreground" />
							</div>
							{!collapsed && (
								<div>
									<p className="text-sm font-bold text-foreground">
										PPE Monitor
									</p>
									<p className="text-[10px] text-muted-foreground font-mono">
										YOLOv8m
									</p>
								</div>
							)}
						</div>
					</SidebarGroupContent>
				</SidebarGroup>

				<Separator />

				{/* Navigation */}
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild>
										<NavLink
											to={item.url}
											end={item.url === "/"}
											className="hover:bg-accent/50"
											activeClassName="bg-accent text-primary font-semibold"
										>
											<item.icon className="mr-2 h-4 w-4" />
											{!collapsed && <span>{item.title}</span>}
										</NavLink>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{!collapsed && (
					<>
						<Separator />

						{/* Model Status */}
						<SidebarGroup>
							<SidebarGroupLabel>Model</SidebarGroupLabel>
							<SidebarGroupContent>
								<div className="space-y-2 px-2">
									<div className="flex items-center justify-between">
										<span className="text-xs text-muted-foreground">
											Status
										</span>
										<Badge
											variant={config.model_loaded ? "default" : "destructive"}
											className={
												config.model_loaded
													? "bg-safety-green text-safety-green-foreground text-[10px]"
													: "text-[10px]"
											}
										>
											{config.model_loaded ? "Loaded" : "Not Loaded"}
										</Badge>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-xs text-muted-foreground">
											Weights
										</span>
										<span className="text-xs font-mono text-foreground">
											{config.model_name}
										</span>
									</div>
									<FileUploadButton
										onUpload={uploadModel}
										accept=".pt,.pth,.onnx"
										label="Upload Weights"
										variant="outline"
										size="sm"
										className="w-full text-xs"
									/>
								</div>
							</SidebarGroupContent>
						</SidebarGroup>

						<Separator />

						{/* Inference Settings */}
						<SidebarGroup>
							<SidebarGroupLabel>Inference Settings</SidebarGroupLabel>
							<SidebarGroupContent>
								<div className="space-y-4 px-2">
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-xs text-muted-foreground">
												Confidence
											</span>
											<span className="text-xs font-mono text-foreground">
												{config.confidence_threshold.toFixed(2)}
											</span>
										</div>
										<Slider
											value={[config.confidence_threshold]}
											onValueChange={([v]) =>
												setConfig({ confidence_threshold: v })
											}
											min={0.1}
											max={0.95}
											step={0.05}
										/>
									</div>
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-xs text-muted-foreground">
												NMS IoU
											</span>
											<span className="text-xs font-mono text-foreground">
												{config.nms_iou_threshold.toFixed(2)}
											</span>
										</div>
										<Slider
											value={[config.nms_iou_threshold]}
											onValueChange={([v]) =>
												setConfig({ nms_iou_threshold: v })
											}
											min={0.1}
											max={0.95}
											step={0.05}
										/>
									</div>
								</div>
							</SidebarGroupContent>
						</SidebarGroup>
					</>
				)}
			</SidebarContent>

			{!collapsed && (
				<SidebarFooter>
					<div className="space-y-2 px-2 pb-2">
						<Separator />
						<div className="flex items-center justify-between">
							<span className="text-[10px] text-muted-foreground">
								Session: {sessionStart.toLocaleTimeString()}
							</span>
							<div className="flex gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={toggleDarkMode}
								>
									{isDarkMode ? (
										<Sun className="h-3 w-3" />
									) : (
										<Moon className="h-3 w-3" />
									)}
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={() => window.location.reload()}
								>
									<RotateCcw className="h-3 w-3" />
								</Button>
							</div>
						</div>
					</div>
				</SidebarFooter>
			)}
		</Sidebar>
	);
}
