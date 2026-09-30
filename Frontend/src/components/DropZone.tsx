import React, { useCallback, useRef, useState } from "react";
import { FileImage, FileVideo, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaType = "image" | "video";

interface DropZoneProps {
	onFileSelect: (type: MediaType, file: File) => void;
	accept?: string;
}

function mediaTypeOf(file: File): MediaType | null {
	if (file.type.startsWith("image/")) return "image";
	if (file.type.startsWith("video/")) return "video";
	return null;
}

export function DropZone({
	onFileSelect,
	accept = "image/*,video/*",
}: DropZoneProps) {
	const [dragOver, setDragOver] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(
		(file: File | undefined) => {
			if (!file) return;
			const type = mediaTypeOf(file);
			if (!type) {
				setError(
					`"${file.name}" isn't an image or video. Choose a JPG or PNG photo, or an MP4 or AVI video.`,
				);
				return;
			}
			setError(null);
			onFileSelect(type, file);
		},
		[onFileSelect],
	);

	const openPicker = () => fileInputRef.current?.click();

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			openPicker();
		}
	};

	return (
		<div>
			<div
				role="button"
				tabIndex={0}
				aria-label="Choose a photo or video to analyse"
				aria-describedby={error ? "dropzone-error" : undefined}
				onClick={openPicker}
				onKeyDown={handleKeyDown}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragOver(false);
					handleFile(e.dataTransfer.files[0]);
				}}
				className={cn(
					"group flex min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card px-6 py-12 text-center transition-colors",
					dragOver
						? "border-primary bg-primary/5"
						: "border-input hover:border-foreground/40",
				)}
			>
				<span
					className={cn(
						"mb-5 flex h-14 w-14 items-center justify-center rounded-lg transition-colors",
						dragOver
							? "bg-primary text-primary-foreground"
							: "bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground",
					)}
				>
					<Upload className="h-6 w-6" />
				</span>
				<p className="text-lg font-semibold">
					{dragOver ? "Release to analyse" : "Drop a site photo or video"}
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					or{" "}
					<span className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">
						browse files
					</span>
				</p>
				<div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<FileImage className="h-3.5 w-3.5" />
						JPG, PNG
					</span>
					<span className="flex items-center gap-1.5">
						<FileVideo className="h-3.5 w-3.5" />
						MP4, AVI
					</span>
				</div>
			</div>
			{error && (
				<p
					id="dropzone-error"
					role="alert"
					className="mt-3 text-[13px] text-danger"
				>
					{error}
				</p>
			)}
			<input
				ref={fileInputRef}
				type="file"
				accept={accept}
				tabIndex={-1}
				aria-hidden
				className="sr-only"
				onChange={(e) => {
					handleFile(e.target.files?.[0]);
					// Reset so the same file can be chosen again
					e.target.value = "";
				}}
			/>
		</div>
	);
}

export type { MediaType };
