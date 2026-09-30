import { useCallback, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface FileUploadButtonProps {
	onUpload: (file: File) => unknown | Promise<unknown>;
	accept?: string;
	label?: string;
	busyLabel?: string;
	variant?: ButtonProps["variant"];
	size?: ButtonProps["size"];
	className?: string;
	disabled?: boolean;
}

export function FileUploadButton({
	onUpload,
	accept = ".pt,.pth,.onnx",
	label = "Upload",
	busyLabel = "Uploading…",
	variant = "secondary",
	size = "sm",
	className = "",
	disabled = false,
}: FileUploadButtonProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);

	const handleChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			// Reset so the same file can be chosen again
			e.target.value = "";
			if (!file) return;
			setBusy(true);
			try {
				await onUpload(file);
			} finally {
				setBusy(false);
			}
		},
		[onUpload],
	);

	return (
		<>
			<Button
				variant={variant}
				size={size}
				className={className}
				disabled={disabled || busy}
				aria-busy={busy}
				onClick={() => fileInputRef.current?.click()}
			>
				{busy ? <Loader2 className="animate-spin" /> : <Upload />}
				{busy ? busyLabel : label}
			</Button>
			<input
				ref={fileInputRef}
				type="file"
				accept={accept}
				tabIndex={-1}
				aria-hidden
				className="sr-only"
				onChange={handleChange}
			/>
		</>
	);
}
