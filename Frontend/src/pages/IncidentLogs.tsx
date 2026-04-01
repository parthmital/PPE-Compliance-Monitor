import { useState } from "react";
import { motion } from "framer-motion";
import {
	Download,
	Trash2,
	AlertTriangle,
	Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePPE } from "@/contexts/PPEContext";
import { ImageModal } from "@/components";
import { formatClassName, getIncidentImageUrl, type Incident } from "@/lib";

// CSV Export Utility
function exportIncidentsToCSV(incidents: Incident[]): void {
	const header = "ID,Timestamp,Missing PPE,Frame Number,Image Path\n";
	const rows = incidents
		.map(
			(inc) =>
				`${inc.id},"${inc.timestamp}","${inc.missing_ppe.join("; ")}",${inc.frame_number},${inc.image_path || ""}`,
		)
		.join("\n");
	const blob = new Blob([header + rows], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `ppe_incidents_${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

// Incident Counter Component
function ViolationCounter({ count }: { count: number }) {
	return (
		<motion.div
			initial={{ scale: 0.95, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
		>
			<Card className="border-safety-red/20 bg-safety-red/5">
				<CardContent className="py-4 flex items-center gap-3">
					<AlertTriangle className="h-5 w-5 text-safety-red" />
					<div>
						<span className="text-2xl font-bold font-mono text-safety-red">
							{count}
						</span>
						<span className="text-sm text-muted-foreground ml-2">
							Confirmed Violations
						</span>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

// Incident Gallery Component
function IncidentGallery({
	incidents,
	onImageClick,
}: {
	incidents: Incident[];
	onImageClick: (url: string) => void;
}) {
	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ delay: 0.2 }}
		>
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm">Incident Snapshots</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{incidents.map((inc, i) => {
							const imageUrl = getIncidentImageUrl(inc.image_path);
							return (
								<motion.div
									key={inc.id}
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ delay: 0.1 + i * 0.05 }}
									className="group relative rounded-lg overflow-hidden border bg-muted cursor-pointer"
									onClick={() => imageUrl && onImageClick(imageUrl)}
								>
									<div className="aspect-video flex items-center justify-center bg-gradient-to-br from-muted to-secondary/30">
										{imageUrl ? (
											<img
												src={imageUrl}
												alt={`Incident at ${inc.timestamp}`}
												className="w-full h-full object-cover"
												onError={(e) => {
													(e.target as HTMLImageElement).style.display = "none";
												}}
											/>
										) : (
											<ImageIcon className="h-8 w-8 text-muted-foreground/30" />
										)}
									</div>
									<div className="absolute bottom-0 inset-x-0 bg-background/90 backdrop-blur p-2">
										<p className="text-[10px] font-mono text-muted-foreground">
											{inc.timestamp}
										</p>
										<div className="flex gap-1 mt-1">
											{inc.missing_ppe.map((className) => (
												<span
													key={className}
													className="text-[9px] text-safety-red font-medium"
												>
													{formatClassName(className)}
												</span>
											))}
										</div>
									</div>
								</motion.div>
							);
						})}
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

// Main Incident Logs Page
export default function IncidentLogs() {
	const { incidents, clearAllIncidents } = usePPE();
	const [selectedImage, setSelectedImage] = useState<string | null>(null);

	return (
		<div className="space-y-6">
			<ImageModal
				imageUrl={selectedImage}
				onClose={() => setSelectedImage(null)}
				alt="Incident"
			/>

			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Incident Logs</h1>
					<p className="text-sm text-muted-foreground">
						Review confirmed PPE violations
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						className="gap-1 text-xs"
						onClick={() => exportIncidentsToCSV(incidents)}
					>
						<Download className="h-3 w-3" /> Export CSV
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="destructive" size="sm" className="gap-1 text-xs">
								<Trash2 className="h-3 w-3" /> Clear All
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Clear all incidents?</AlertDialogTitle>
								<AlertDialogDescription>
									This will permanently remove all {incidents.length} incident
									records. This action cannot be undone.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={clearAllIncidents}>
									Clear All
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>

			<ViolationCounter count={incidents.length} />

			{/* Incident Table */}
			<motion.div
				initial={{ y: 10, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.1 }}
			>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Violation Records</CardTitle>
					</CardHeader>
					<CardContent>
						{incidents.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground text-sm">
								No incidents recorded
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="text-xs">Timestamp</TableHead>
										<TableHead className="text-xs">Missing PPE</TableHead>
										<TableHead className="text-xs">Frame #</TableHead>
										<TableHead className="text-xs">Image</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{incidents.map((inc, i) => (
										<motion.tr
											key={inc.id}
											initial={{ opacity: 0, x: -10 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: i * 0.05 }}
											className="border-b border-border"
										>
											<TableCell className="py-2 text-xs font-mono">
												{inc.timestamp}
											</TableCell>
											<TableCell className="py-2">
												<div className="flex gap-1 flex-wrap">
													{inc.missing_ppe.map((className) => (
														<Badge
															key={className}
															variant="destructive"
															className="text-[10px]"
														>
															{formatClassName(className)}
														</Badge>
													))}
												</div>
											</TableCell>
											<TableCell className="py-2 text-xs font-mono">
												{inc.frame_number}
											</TableCell>
											<TableCell className="py-2">
												{inc.image_path ? (
													<Button
														variant="ghost"
														size="sm"
														className="h-6 text-xs gap-1"
														onClick={() =>
															setSelectedImage(
																getIncidentImageUrl(inc.image_path)!,
															)
														}
													>
														<ImageIcon className="h-3 w-3" />
														View
													</Button>
												) : (
													<span className="text-xs text-muted-foreground">
														-
													</span>
												)}
											</TableCell>
										</motion.tr>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</motion.div>

			{incidents.length > 0 && (
				<IncidentGallery
					incidents={incidents}
					onImageClick={setSelectedImage}
				/>
			)}
		</div>
	);
}
