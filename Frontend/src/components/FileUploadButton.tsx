import { useState, useRef, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadButtonProps {
	onUpload: (file: File) => unknown | Promise<unknown>;
	accept?: string;
	label?: string;
	variant?: "default" | "outline" | "ghost";
	size?: "default" | "sm" | "lg" | "icon";
	className?: string;
}

export function FileUploadButton({
	onUpload,
	accept = ".pt,.pth,.onnx",
	label = "Upload",
	variant = "outline",
	size = "sm",
	className = "",
}: FileUploadButtonProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleClick = () => {
		fileInputRef.current?.click();
	};

	const handleChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				await onUpload(file);
			}
			// Reset input so same file can be selected again
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		},
		[onUpload],
	);

	return (
		<>
			<Button
				variant={variant}
				size={size}
				className={`gap-1 ${className}`}
				onClick={handleClick}
			>
				<Upload className="h-3 w-3" />
				{label}
			</Button>
			<input
				ref={fileInputRef}
				type="file"
				accept={accept}
				className="hidden"
				onChange={handleChange}
			/>
		</>
	);
}
