import { useEffect, useRef, useState } from "react";
import { FileVideo, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { WithTooltip } from "@/components/ui/tooltip";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
	src: string | null;
	badge?: React.ReactNode;
}

const controlButton =
	"inline-flex h-9 w-9 items-center justify-center rounded-md text-white transition-colors hover:bg-white/15";

export function VideoPlayer({ src, badge }: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [controlsVisible, setControlsVisible] = useState(true);

	useEffect(
		() => () => {
			if (hideTimer.current) clearTimeout(hideTimer.current);
		},
		[],
	);

	const revealControls = () => {
		setControlsVisible(true);
		if (hideTimer.current) clearTimeout(hideTimer.current);
		hideTimer.current = setTimeout(() => setControlsVisible(false), 2500);
	};

	const togglePlay = () => {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) video.play();
		else video.pause();
	};

	const seekTo = (time: number) => {
		const video = videoRef.current;
		if (!video) return;
		video.currentTime = Math.max(0, Math.min(duration, time));
		setCurrentTime(video.currentTime);
	};

	if (!src) {
		return (
			<div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border bg-neutral-950 px-6 text-center text-neutral-300">
				{badge && <div className="mb-2">{badge}</div>}
				<FileVideo className="h-8 w-8 text-neutral-500" />
				<p className="font-medium">Preview not available after a page reload</p>
				<p className="text-[13px] text-neutral-400">
					Analysis continues on the server. Progress is shown alongside.
				</p>
			</div>
		);
	}

	const showControls = controlsVisible || !playing;

	return (
		<div
			className="group relative aspect-video overflow-hidden rounded-lg border bg-neutral-950"
			onPointerMove={revealControls}
			onFocus={() => setControlsVisible(true)}
		>
			<video
				ref={videoRef}
				src={src}
				className="absolute inset-0 h-full w-full object-contain"
				onPlay={() => {
					setPlaying(true);
					revealControls();
				}}
				onPause={() => setPlaying(false)}
				onEnded={() => setPlaying(false)}
				onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
				onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
				onClick={togglePlay}
			/>

			{badge && <div className="absolute left-3 top-3 z-20">{badge}</div>}

			{!playing && (
				<button
					type="button"
					aria-label="Play video"
					onClick={togglePlay}
					className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
				>
					<Play className="ml-0.5 h-6 w-6" fill="currentColor" />
				</button>
			)}

			<div
				className={cn(
					"absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200",
					showControls ? "opacity-100" : "opacity-0 focus-within:opacity-100",
				)}
			>
				<Slider
					tone="onMedia"
					thumbLabel="Seek"
					value={[currentTime]}
					min={0}
					max={duration || 1}
					step={0.1}
					onValueChange={([t]) => seekTo(t)}
				/>
				<div className="mt-1 flex items-center justify-between">
					<div className="flex items-center gap-0.5">
						<WithTooltip label={playing ? "Pause" : "Play"}>
							<button
								type="button"
								aria-label={playing ? "Pause" : "Play"}
								onClick={togglePlay}
								className={controlButton}
							>
								{playing ? (
									<Pause className="h-4 w-4" fill="currentColor" />
								) : (
									<Play className="h-4 w-4" fill="currentColor" />
								)}
							</button>
						</WithTooltip>
						<WithTooltip label="Back 10 seconds">
							<button
								type="button"
								aria-label="Back 10 seconds"
								onClick={() => seekTo(currentTime - 10)}
								className={controlButton}
							>
								<RotateCcw className="h-4 w-4" />
							</button>
						</WithTooltip>
						<WithTooltip label="Forward 10 seconds">
							<button
								type="button"
								aria-label="Forward 10 seconds"
								onClick={() => seekTo(currentTime + 10)}
								className={controlButton}
							>
								<RotateCw className="h-4 w-4" />
							</button>
						</WithTooltip>
					</div>
					<span className="font-mono text-xs text-white/85">
						{formatDuration(currentTime)} / {formatDuration(duration)}
					</span>
				</div>
			</div>
		</div>
	);
}
