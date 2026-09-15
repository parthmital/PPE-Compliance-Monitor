import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ImageModalProps {
	imageUrl: string | null;
	onClose: () => void;
	alt?: string;
}

export function ImageModal({
	imageUrl,
	onClose,
	alt = "Image",
}: ImageModalProps) {
	return (
		<AnimatePresence>
			{imageUrl && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
					onClick={onClose}
				>
					<motion.div
						initial={{ scale: 0.9 }}
						animate={{ scale: 1 }}
						exit={{ scale: 0.9 }}
						className="relative max-w-4xl w-full"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							onClick={onClose}
							className="absolute -top-10 right-0 text-white hover:text-gray-300"
						>
							<X className="h-6 w-6" />
						</button>
						<img
							src={imageUrl}
							alt={alt}
							className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
						/>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
