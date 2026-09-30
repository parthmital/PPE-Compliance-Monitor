import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePPE } from "@/contexts/PPEContext";
import { DropZone, PageHeader, type MediaType } from "@/components";
import { ImageResult } from "./ImageResult";
import { NotReady } from "./NotReady";
import { VideoResult } from "./VideoResult";
import { Workspace } from "./Workspace";

export default function DetectionPage() {
	const {
		connection,
		config,
		uploadImage,
		imageDimensions,
		videoProcessing,
		videoProgress,
		videoFramesProcessed,
		setVideoProcessing,
		detectionMediaType: mediaType,
		detectionDetections,
		detectionImageFileName,
		detectionIsImageProcessing,
		setDetectionState,
		clearDetectionState,
	} = usePPE();
	// File objects and object URLs cannot be persisted, so they stay local.
	const [currentFile, setCurrentFile] = useState<File | null>(null);
	const [imageUrl, setImageUrl] = useState<string | null>(null);

	const handleFileSelect = async (type: MediaType, file: File) => {
		setCurrentFile(file);
		if (type === "image") {
			setImageUrl(URL.createObjectURL(file));
			setDetectionState({
				mediaType: type,
				detections: [],
				imageFileName: file.name,
				videoFileName: null,
				isImageProcessing: true,
			});
			const result = await uploadImage(file);
			setDetectionState({
				detections: result?.detections ?? [],
				isImageProcessing: false,
			});
		} else {
			setImageUrl(null);
			setDetectionState({
				mediaType: type,
				detections: [],
				imageFileName: null,
				videoFileName: file.name,
				isImageProcessing: false,
			});
		}
	};

	const handleNewAnalysis = () => {
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		setImageUrl(null);
		clearDetectionState();
		setCurrentFile(null);
		setVideoProcessing(false);
	};

	const hasVideoProcessing =
		videoProcessing || videoProgress > 0 || videoFramesProcessed > 0;
	const showVideo =
		mediaType === "video" && (currentFile || hasVideoProcessing);
	const showingResult = mediaType === "image" || showVideo;
	const ready = connection === "online" && config.model_loaded;

	return (
		<>
			<PageHeader
				title="Analyse"
				description="Check a site photo or video for missing hard hats and safety vests."
				actions={
					showingResult && (
						<Button variant="secondary" onClick={handleNewAnalysis}>
							<Plus />
							New analysis
						</Button>
					)
				}
			/>

			{mediaType === "image" && (
				<ImageResult
					detections={detectionDetections}
					imageUrl={imageUrl || undefined}
					imageDimensions={imageDimensions}
					isProcessing={detectionIsImageProcessing}
					fileName={detectionImageFileName}
				/>
			)}
			{showVideo && <VideoResult file={currentFile} />}
			{!showingResult && (
				<Workspace>
					{ready ? <DropZone onFileSelect={handleFileSelect} /> : <NotReady />}
				</Workspace>
			)}
		</>
	);
}
