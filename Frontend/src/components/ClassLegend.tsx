import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PPE_CLASSES, formatClassName } from "@/lib/ppe-types";

interface ClassLegendProps {
	className?: string;
}

export function ClassLegend({ className = "" }: ClassLegendProps) {
	return (
		<motion.div
			initial={{ y: 10, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ delay: 0.4, duration: 0.3 }}
			className={className}
		>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-medium">
						Detection Classes
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-2">
						{PPE_CLASSES.map((cls) => (
							<div key={cls.name} className="flex items-center gap-2 text-xs">
								<div
									className="h-3 w-3 rounded-full shrink-0"
									style={{ backgroundColor: cls.color }}
								/>
								<span className="text-foreground">
									{formatClassName(cls.name)}
								</span>
								<span className="ml-auto">{cls.emoji}</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}
