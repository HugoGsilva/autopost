"use client";

import { Button } from "@autopost/ui/components/button";
import { Progress } from "@autopost/ui/components/progress";
import { cn } from "@autopost/ui/lib/utils";
import { CheckCircle2, Film, RefreshCw, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { formatBytes, formatDuration } from "@/lib/format";

import type { useVideoUpload } from "./use-upload";

export function VideoDrop({
	upload,
}: {
	upload: ReturnType<typeof useVideoUpload>;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const { media, previewUrl, progress, error, uploading } = upload;

	const pick = (files?: FileList | null) => {
		const file = files?.[0];
		if (file) upload.upload(file);
	};

	const input = (
		<input
			ref={inputRef}
			type="file"
			accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
			className="sr-only"
			data-testid="video-input"
			onChange={(e) => {
				pick(e.target.files);
				e.target.value = "";
			}}
		/>
	);

	if (previewUrl) {
		const vertical = (media?.height ?? 0) > (media?.width ?? 0);
		return (
			<div className="flex flex-col gap-4 sm:flex-row">
				{/* No desktop a prévia fica no Resumo (evita vídeo duplicado) */}
				<div className="relative overflow-hidden rounded-xl border bg-black sm:w-48 lg:hidden">
					<video
						src={previewUrl}
						className={cn(
							"w-full object-contain",
							vertical ? "aspect-[9/16]" : "aspect-video",
						)}
						muted
						loop
						autoPlay
						playsInline
						controls
					/>
				</div>
				<div className="flex flex-1 flex-col justify-between gap-4">
					<div className="space-y-1">
						<p className="flex items-center gap-2 font-medium">
							<Film className="text-gold-ink size-4" />
							<span className="truncate">
								{media?.fileName ?? "Enviando vídeo..."}
							</span>
						</p>
						{media && (
							<p className="text-muted-foreground text-sm">
								{[
									formatBytes(media.size),
									media.durationSec ? formatDuration(media.durationSec) : null,
									media.width && media.height
										? vertical
											? "vertical"
											: "horizontal"
										: null,
								]
									.filter(Boolean)
									.join(" · ")}
							</p>
						)}
					</div>
					{uploading && (
						<div className="space-y-2">
							<Progress value={progress ?? 0} />
							<div className="flex items-center justify-between gap-2">
								<p className="text-muted-foreground text-xs">
									Enviando... {progress}% — não feche esta página
								</p>
								<Button variant="ghost" size="sm" onClick={upload.reset}>
									Cancelar
								</Button>
							</div>
						</div>
					)}
					{media && (
						<p
							className="text-success flex items-center gap-2 text-sm"
							data-testid="upload-done"
						>
							<CheckCircle2 className="size-4" /> Vídeo pronto para publicar
						</p>
					)}
					{error && <p className="text-destructive text-sm">{error}</p>}
					<div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => inputRef.current?.click()}
						>
							<RefreshCw /> Trocar vídeo
						</Button>
						{input}
					</div>
				</div>
			</div>
		);
	}

	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: o input file fica dentro do label (via variável)
		<label
			className={cn(
				"flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all",
				dragging
					? "border-gold bg-accent/40 scale-[1.01]"
					: "border-border hover:border-gold/60 hover:bg-accent/20",
			)}
			onDragOver={(e) => {
				e.preventDefault();
				setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={(e) => {
				e.preventDefault();
				setDragging(false);
				pick(e.dataTransfer.files);
			}}
		>
			<span className="bg-primary/15 text-gold-ink flex size-14 items-center justify-center rounded-full">
				<UploadCloud className="size-7" />
			</span>
			<span className="font-display text-xl">Arraste o vídeo aqui</span>
			<span className="text-muted-foreground text-sm">
				ou clique para escolher · MP4, MOV ou WebM até 4 GB
			</span>
			{error && <span className="text-destructive text-sm">{error}</span>}
			{input}
		</label>
	);
}
