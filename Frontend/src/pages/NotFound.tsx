import { Link, useLocation } from "react-router-dom";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components";

const NotFound = () => {
	const location = useLocation();

	return (
		<Panel className="mt-6">
			<EmptyState
				icon={MapPinOff}
				title="Page not found"
				className="py-20"
				action={
					<Button asChild>
						<Link to="/">Go to overview</Link>
					</Button>
				}
			>
				Nothing lives at{" "}
				<span className="font-mono text-xs">{location.pathname}</span>.
			</EmptyState>
		</Panel>
	);
};

export default NotFound;
