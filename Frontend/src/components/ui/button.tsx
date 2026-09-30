import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-semibold transition-[background-color,border-color,color,filter,transform] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:brightness-95 active:brightness-90",
				secondary:
					"border border-input bg-card text-foreground hover:bg-accent active:bg-secondary",
				ghost:
					"text-muted-foreground hover:bg-accent hover:text-foreground active:bg-secondary",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
				"destructive-ghost":
					"text-danger hover:bg-destructive/10 active:bg-destructive/15",
				link: "h-auto px-0 text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground",
			},
			size: {
				default: "h-9 px-3.5",
				sm: "h-8 px-3",
				lg: "h-11 px-5 text-sm",
				icon: "h-9 w-9",
				"icon-sm": "h-8 w-8",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends
		React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...(asChild ? {} : { type: "button" })}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
