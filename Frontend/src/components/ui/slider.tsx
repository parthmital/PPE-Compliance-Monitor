import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<
	typeof SliderPrimitive.Root
> {
	tone?: "default" | "onMedia";
	thumbLabel?: string;
}

const Slider = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Root>,
	SliderProps
>(({ className, tone = "default", thumbLabel, ...props }, ref) => (
	<SliderPrimitive.Root
		ref={ref}
		className={cn(
			"relative flex h-5 w-full cursor-pointer touch-none select-none items-center data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	>
		<SliderPrimitive.Track
			className={cn(
				"relative h-1 w-full grow overflow-hidden rounded-full",
				tone === "onMedia" ? "bg-white/30" : "bg-secondary",
			)}
		>
			<SliderPrimitive.Range
				className={cn(
					"absolute h-full",
					tone === "onMedia" ? "bg-primary" : "bg-foreground dark:bg-primary",
				)}
			/>
		</SliderPrimitive.Track>
		<SliderPrimitive.Thumb
			aria-label={thumbLabel}
			className={cn(
				"block h-4 w-4 rounded-full border-2 shadow-sm transition-transform hover:scale-110 focus-visible:scale-110",
				tone === "onMedia"
					? "border-primary bg-white"
					: "border-foreground bg-card dark:border-primary",
			)}
		/>
	</SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
