import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
	<Sonner
		position="bottom-right"
		toastOptions={{
			classNames: {
				toast:
					"!rounded-lg !border !border-border !bg-popover !text-popover-foreground !font-sans !shadow-lg",
				title: "!text-[13px] !font-semibold",
				description: "!text-muted-foreground",
				success: "[&_[data-icon]]:!text-success",
				error: "[&_[data-icon]]:!text-danger",
				actionButton: "!bg-primary !text-primary-foreground",
			},
		}}
		{...props}
	/>
);

export { Toaster, toast };
