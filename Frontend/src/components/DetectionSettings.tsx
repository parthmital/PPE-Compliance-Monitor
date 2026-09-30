import { Panel, PanelHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { FileUploadButton } from "@/components/FileUploadButton";
import { usePPE } from "@/contexts/PPEContext";
import { cn } from "@/lib/utils";

interface ThresholdProps {
	label: string;
	help: string;
	value: number;
	disabled: boolean;
	onChange: (value: number) => void;
}

function Threshold({ label, help, value, disabled, onChange }: ThresholdProps) {
	return (
		<div>
			<div className="mb-2 flex items-baseline justify-between gap-3">
				<span className="text-[13px] font-medium">{label}</span>
				<span className="font-mono text-[13px] font-semibold">
					{value.toFixed(2)}
				</span>
			</div>
			<Slider
				thumbLabel={label}
				value={[value]}
				onValueChange={([v]) => onChange(v)}
				min={0.1}
				max={0.95}
				step={0.05}
				disabled={disabled}
			/>
			<p className="mt-2 text-xs text-muted-foreground">{help}</p>
		</div>
	);
}

export function DetectionSettings() {
	const { connection, config, metrics, setConfig, uploadModel } = usePPE();
	const online = connection === "online";
	const modelReady = online && config.model_loaded;

	return (
		<Panel>
			<PanelHeader title="Detection settings" />
			<div className="space-y-5 p-4">
				<div>
					<p className="text-[13px] font-medium">Model</p>
					<div className="mt-2 flex items-center gap-2">
						<span
							aria-hidden
							className={cn(
								"h-2 w-2 shrink-0 rounded-full",
								modelReady ? "bg-success" : "bg-destructive",
							)}
						/>
						<span className="min-w-0 truncate font-mono text-[13px]">
							{modelReady ? config.model_name || "Loaded" : "No model loaded"}
						</span>
					</div>
					{modelReady && metrics.detection_accuracy > 0 && (
						<p className="mt-1 text-xs text-muted-foreground">
							Validation mAP@0.5{" "}
							<span className="font-mono">
								{metrics.detection_accuracy.toFixed(2)}
							</span>
						</p>
					)}
					<FileUploadButton
						onUpload={uploadModel}
						accept=".pt,.pth,.onnx"
						label={modelReady ? "Replace weights" : "Upload weights"}
						busyLabel="Loading model…"
						variant="secondary"
						className="mt-3 w-full"
						disabled={!online}
					/>
					<p className="mt-2 text-xs text-muted-foreground">
						YOLO weights as .pt, .pth or .onnx.
					</p>
				</div>

				<div className="space-y-5 border-t pt-5">
					<Threshold
						label="Confidence threshold"
						help="Detections scoring below this are ignored."
						value={config.confidence_threshold}
						disabled={!online}
						onChange={(v) => setConfig({ confidence_threshold: v })}
					/>
					<Threshold
						label="Overlap threshold (NMS IoU)"
						help="Higher values keep more overlapping boxes."
						value={config.nms_iou_threshold}
						disabled={!online}
						onChange={(v) => setConfig({ nms_iou_threshold: v })}
					/>
					<p className="text-xs text-muted-foreground">
						Changes apply to the next analysis.
					</p>
				</div>
			</div>
		</Panel>
	);
}
