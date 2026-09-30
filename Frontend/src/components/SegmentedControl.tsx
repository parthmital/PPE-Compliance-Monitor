import { useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
	value: T;
	label: string;
	icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
	label: string;
	value: T;
	options: Option<T>[];
	onChange: (value: T) => void;
}

// Radio-group semantics with roving focus: arrow keys move and select.
export function SegmentedControl<T extends string>({
	label,
	value,
	options,
	onChange,
}: SegmentedControlProps<T>) {
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const selectedIndex = options.findIndex((o) => o.value === value);
	const [indicator, setIndicator] = useState<{ left: number; width: number }>();

	// Slide one shared highlight under the selected option.
	useLayoutEffect(() => {
		const el = refs.current[selectedIndex];
		if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
	}, [selectedIndex, options]);

	const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
		const step =
			e.key === "ArrowRight" || e.key === "ArrowDown"
				? 1
				: e.key === "ArrowLeft" || e.key === "ArrowUp"
					? -1
					: 0;
		if (!step) return;
		e.preventDefault();
		const next = (index + step + options.length) % options.length;
		onChange(options[next].value);
		refs.current[next]?.focus();
	};

	return (
		<div
			role="radiogroup"
			aria-label={label}
			className="relative inline-flex h-9 items-center rounded-md border border-input bg-card p-0.5"
		>
			{indicator && (
				<span
					aria-hidden
					className="absolute inset-y-0.5 left-0 rounded-[4px] bg-foreground transition-[transform,width] duration-200 ease-out"
					style={{
						width: indicator.width,
						transform: `translateX(${indicator.left}px)`,
					}}
				/>
			)}
			{options.map((option, index) => {
				const selected = option.value === value;
				const Icon = option.icon;
				return (
					<button
						key={option.value}
						ref={(el) => (refs.current[index] = el)}
						type="button"
						role="radio"
						aria-checked={selected}
						tabIndex={selected ? 0 : -1}
						onClick={() => onChange(option.value)}
						onKeyDown={(e) => handleKeyDown(e, index)}
						className={cn(
							"relative inline-flex h-full items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] font-semibold transition-colors duration-200",
							selected
								? cn("text-background", !indicator && "bg-foreground")
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{Icon && <Icon className="h-3.5 w-3.5" />}
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
