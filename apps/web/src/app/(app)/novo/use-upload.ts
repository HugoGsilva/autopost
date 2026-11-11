"use client";

import { useCallback, useRef, useState } from "react";

export type UploadedMedia = {
	id: string;
	fileName: string;
	mimeType: string;
	size: number;
	durationSec: number | null;
	width: number | null;
	height: number | null;
	url: string;
};

type VideoMeta = { duration: number; width: number; height: number };

const ACCEPTED = ["video/mp4", "video/quicktime", "video/webm"];

/** Lê duração e resolução direto no navegador antes de enviar. */
function readVideoMeta(file: File): Promise<VideoMeta | null> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const video = document.createElement("video");
		video.preload = "metadata";
		video.muted = true;
		const done = (meta: VideoMeta | null) => {
			URL.revokeObjectURL(url);
			resolve(meta);
		};
		video.onloadedmetadata = () =>
			done({
				duration: video.duration,
				width: video.videoWidth,
				height: video.videoHeight,
			});
		video.onerror = () => done(null);
		setTimeout(() => done(null), 8000);
		video.src = url;
	});
}

export function useVideoUpload() {
	const [media, setMedia] = useState<UploadedMedia | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const xhrRef = useRef<XMLHttpRequest | null>(null);

	const reset = useCallback(() => {
		xhrRef.current?.abort();
		setMedia(null);
		setProgress(null);
		setError(null);
		setPreviewUrl((old) => {
			if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
			return null;
		});
	}, []);

	const upload = useCallback(
		async (file: File) => {
			reset();
			const type =
				file.type ||
				(file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "");
			if (!ACCEPTED.includes(type)) {
				setError("Formato não suportado. Envie um vídeo MP4, MOV ou WebM.");
				return;
			}
			setPreviewUrl(URL.createObjectURL(file));
			setProgress(0);
			const meta = await readVideoMeta(file);

			const xhr = new XMLHttpRequest();
			xhrRef.current = xhr;
			xhr.open("POST", "/api/media");
			xhr.setRequestHeader("Content-Type", type);
			xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
			if (meta) {
				xhr.setRequestHeader("x-duration", String(meta.duration));
				xhr.setRequestHeader("x-width", String(meta.width));
				xhr.setRequestHeader("x-height", String(meta.height));
			}
			xhr.upload.onprogress = (e) =>
				e.lengthComputable &&
				setProgress(Math.round((e.loaded / e.total) * 100));
			xhr.onload = () => {
				let body: any = null;
				try {
					body = JSON.parse(xhr.responseText);
				} catch {}
				if (xhr.status >= 200 && xhr.status < 300 && body?.id) {
					setMedia(body);
					setProgress(100);
				} else {
					setError(body?.error ?? `Falha no envio (${xhr.status})`);
					setProgress(null);
				}
			};
			xhr.onerror = () => {
				setError("Conexão interrompida durante o envio.");
				setProgress(null);
			};
			xhr.send(file);
		},
		[reset],
	);

	/** Reaproveita um vídeo já enviado (ex.: "Usar de novo"). */
	const adoptExisting = useCallback(
		(existing: UploadedMedia) => {
			reset();
			setMedia(existing);
			setPreviewUrl(existing.url);
			setProgress(100);
		},
		[reset],
	);

	const uploading = progress !== null && !media && !error;
	return {
		media,
		previewUrl,
		progress,
		error,
		uploading,
		upload,
		reset,
		adoptExisting,
	};
}
