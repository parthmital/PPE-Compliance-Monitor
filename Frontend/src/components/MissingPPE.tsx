import { Badge } from "@/components/ui/badge";
import { formatClassName } from "@/lib";

export function MissingPPE({ items }: { items: string[] }) {
	return (
		<div className="flex flex-wrap gap-1">
			{items.map((item) => (
				<Badge key={item} variant="danger">
					{formatClassName(item)}
				</Badge>
			))}
		</div>
	);
}
