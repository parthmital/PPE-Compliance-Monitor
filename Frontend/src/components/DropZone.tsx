import React, { useCallback, useState, useRef } from "react";
import { Upload } from "lucide-react";

type MediaType = "image" | "video";

interface DropZoneProps {
	onFileSelect: (type: MediaType, file: File) => void;
	accept?: string;
}

export function DropZone({
	onFileSelect,
	accept = "image/*,video/*",
}: DropZoneProps) {
	const [dragOver, setDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			const file = e.dataTransfer.files[0];
			if (!file) return;
			if (file.type.startsWith("image/")) onFileSelect("image", file);
			else if (file.type.startsWith("video/")) onFileSelect("video", file);
		},
		[onFileSelect],
	);

	const handleClick = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.type.startsWith("image/")) onFileSelect("image", file);
		else if (file.type.startsWith("video/")) onFileSelect("video", file);
		// Reset input so same file can be selected again
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	return (
		<>
			<div
				className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
					dragOver
						? "border-primary bg-primary/5"
						: "border-border hover:border-primary/50"
				}`}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={handleDrop}
				onClick={handleClick}
			>
				<Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
				<p className="text-sm font-medium text-foreground">
					Drop image or video here
				</p>
				<p className="text-xs text-muted-foreground mt-1">or click to browse</p>
				<p className="text-xs text-muted-foreground mt-1">
					JPG, PNG, MP4, AVI supported
				</p>
			</div>
			<input
				ref={fileInputRef}
				type="file"
				accept={accept}
				className="hidden"
				onChange={handleFileChange}
			/>
		</>
	);
}

export type { MediaType };
