import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PPE_CLASSES, formatClassName, type Detection } from "@/lib/ppe-types";

interface DetectionTableProps {
	detections: Detection[];
}

export function DetectionTable({ detections }: DetectionTableProps) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="text-xs">Class</TableHead>
					<TableHead className="text-xs">Confidence</TableHead>
					<TableHead className="text-xs">Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{detections.map((det, i) => {
					const cls = PPE_CLASSES.find((c) => c.name === det.class_name);
					return (
						<TableRow key={i}>
							<TableCell className="py-2">
								<div className="flex items-center gap-2">
									<div
										className="h-2.5 w-2.5 rounded-full"
										style={{ backgroundColor: cls?.color }}
									/>
									<span className="text-xs font-medium">
										{formatClassName(det.class_name)}
									</span>
								</div>
							</TableCell>
							<TableCell className="py-2">
								<span className="text-xs font-mono">
									{(det.confidence * 100).toFixed(1)}%
								</span>
							</TableCell>
							<TableCell className="py-2">
								{det.is_violation ? (
									<Badge variant="destructive" className="text-[10px]">
										Violation
									</Badge>
								) : (
									<Badge
										variant="outline"
										className="text-[10px] border-safety-green/30 text-safety-green"
									>
										OK
									</Badge>
								)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
