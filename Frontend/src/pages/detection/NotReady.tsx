import { Boxes, Loader2, WifiOff } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { usePPE } from "@/contexts/PPEContext";
import { EmptyState, FileUploadButton } from "@/components";

// Shown instead of the drop zone when analysis can't run yet.
export function NotReady() {
	const { connection, uploadModel } = usePPE();

	const content =
		connection === "connecting" ? (
			<EmptyState
				icon={Loader2}
				title="Connecting to the detection server…"
				className="[&_svg]:animate-spin"
			/>
		) : connection === "offline" ? (
			<EmptyState icon={WifiOff} title="Detection server offline">
				Start the backend to analyse media. This page reconnects automatically.
			</EmptyState>
		) : (
			<EmptyState
				icon={Boxes}
				title="No model loaded"
				action={
					<FileUploadButton
						onUpload={uploadModel}
						accept=".pt,.pth,.onnx"
						label="Upload weights"
						busyLabel="Loading model…"
						variant="default"
						size="default"
					/>
				}
			>
				Upload trained YOLO weights (.pt) to start analysing photos and videos.
			</EmptyState>
		);

	return (
		<Panel className="flex min-h-[340px] items-center justify-center">
			{content}
		</Panel>
	);
}
