import { cn } from "@autopost/ui/lib/utils";
import { Sparkles } from "lucide-react";
import {
	siBluesky,
	siDiscord,
	siFacebook,
	siInstagram,
	siPinterest,
	siTelegram,
	siThreads,
	siTiktok,
	siX,
	siYoutube,
} from "simple-icons";

// LinkedIn não está no simple-icons (pedido da marca): glifo próprio.
const linkedinPath =
	"M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z";

const paths: Record<string, string> = {
	instagram: siInstagram.path,
	facebook: siFacebook.path,
	youtube: siYoutube.path,
	tiktok: siTiktok.path,
	linkedin: linkedinPath,
	x: siX.path,
	threads: siThreads.path,
	pinterest: siPinterest.path,
	bluesky: siBluesky.path,
	telegram: siTelegram.path,
	discord: siDiscord.path,
};

export function PlatformIcon({
	platform,
	className,
}: {
	platform: string;
	className?: string;
}) {
	const d = paths[platform];
	if (!d) return <Sparkles className={cn("size-4", className)} aria-hidden />;
	return (
		<svg
			viewBox="0 0 24 24"
			className={cn("size-4 fill-current", className)}
			aria-hidden
		>
			<path d={d} />
		</svg>
	);
}

/** Ícone em "selo" com a cor de marca da plataforma (cor vem do dado do provider). */
export function PlatformBadge({
	platform,
	color,
	className,
	size = "md",
}: {
	platform: string;
	color: string;
	className?: string;
	size?: "sm" | "md" | "lg";
}) {
	const box = {
		sm: "size-6 rounded-md",
		md: "size-9 rounded-lg",
		lg: "size-12 rounded-xl",
	}[size];
	const icon = { sm: "size-3.5", md: "size-4.5", lg: "size-6" }[size];
	const isDark = ["#000000", "#101010"].includes(color.toLowerCase());
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center text-white",
				isDark && "ring-border ring-1",
				box,
				className,
			)}
			style={{ backgroundColor: color }}
		>
			<PlatformIcon platform={platform} className={icon} />
		</span>
	);
}
