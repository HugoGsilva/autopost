import { cn } from "@autopost/ui/lib/utils";
import Image from "next/image";

export function BrandMark({
	className,
	compact,
}: {
	className?: string;
	compact?: boolean;
}) {
	return (
		<span className={cn("inline-flex items-center gap-2.5", className)}>
			<Image
				src="/logo-ia2s.png"
				alt="IA2S"
				width={32}
				height={32}
				className="size-8 rounded-lg"
				priority
			/>
			{!compact && (
				<span className="flex items-baseline gap-1.5 leading-none">
					<span className="font-semibold tracking-wide">IA2S</span>
					<span className="font-display text-gold-ink text-lg italic">
						Cast
					</span>
				</span>
			)}
		</span>
	);
}
