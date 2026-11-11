import { createWriteStream } from "node:fs";
import { mkdir, open, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { Database } from "@autopost/db";
import { media } from "@autopost/db/schema/social";
import { eq } from "drizzle-orm";

import { randomToken } from "./crypto";
import { appUrl, uploadDir } from "./env";

export const ALLOWED_VIDEO_TYPES = [
	"video/mp4",
	"video/quicktime",
	"video/webm",
];
export const MAX_UPLOAD_BYTES =
	Number(process.env.UPLOAD_MAX_MB || 4096) * 1024 * 1024;

export function safeFileName(name: string): string {
	const base = name
		.normalize("NFKD")
		.replace(/[^\w.-]+/g, "_")
		.replace(/_+/g, "_");
	return base.slice(-80) || "video.mp4";
}

export function mediaPublicUrl(row: {
	id: string;
	publicToken: string;
	fileName: string;
}): string {
	return `${appUrl()}/api/media/${row.id}/${row.publicToken}/${encodeURIComponent(row.fileName)}`;
}

export function mediaAbsolutePath(storagePath: string): string {
	return path.join(uploadDir(), storagePath);
}

/** Grava o stream do upload em disco (sem carregar tudo em memória) e registra no banco. */
export async function saveUpload(
	db: Database,
	input: {
		stream: ReadableStream<Uint8Array>;
		fileName: string;
		mimeType: string;
		userId: string;
		durationSec?: number | null;
		width?: number | null;
		height?: number | null;
	},
) {
	const id = randomToken(12);
	const fileName = safeFileName(input.fileName);
	const storagePath = `${new Date().toISOString().slice(0, 7)}/${id}-${fileName}`;
	const abs = mediaAbsolutePath(storagePath);
	await mkdir(path.dirname(abs), { recursive: true });

	let bytes = 0;
	const limiter = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, ctrl) {
			bytes += chunk.byteLength;
			if (bytes > MAX_UPLOAD_BYTES)
				ctrl.error(
					new Error(
						`Arquivo maior que o limite de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
					),
				);
			else ctrl.enqueue(chunk);
		},
	});
	try {
		await pipeline(
			Readable.fromWeb(input.stream.pipeThrough(limiter) as any),
			createWriteStream(abs),
		);
	} catch (err) {
		await rm(abs, { force: true });
		throw err;
	}
	const { size } = await stat(abs);
	if (size === 0) {
		await rm(abs, { force: true });
		throw new Error("Arquivo vazio");
	}
	if (!(await looksLikeVideo(abs, input.mimeType))) {
		await rm(abs, { force: true });
		throw new Error(
			"O arquivo não parece ser um vídeo válido (MP4, MOV ou WebM).",
		);
	}
	// Metadados vêm do navegador: limita a faixa para não estourar as colunas.
	const clamp = (v: number | null | undefined, max: number) =>
		v && Number.isFinite(v) && v > 0 && v <= max ? Math.round(v) : null;
	const [row] = await db
		.insert(media)
		.values({
			id,
			userId: input.userId,
			fileName,
			storagePath,
			mimeType: input.mimeType,
			size,
			durationSec: clamp(input.durationSec, 24 * 3600),
			width: clamp(input.width, 16384),
			height: clamp(input.height, 16384),
			publicToken: randomToken(18),
		})
		.returning()
		.catch(async (err) => {
			await rm(abs, { force: true });
			throw err;
		});
	return row!;
}

/** Confere a assinatura do arquivo: MP4/MOV têm "ftyp" no byte 4; WebM começa com EBML (1A 45 DF A3). */
export async function looksLikeVideo(
	path: string,
	mimeType: string,
): Promise<boolean> {
	const fh = await open(path, "r");
	try {
		const head = new Uint8Array(12);
		await fh.read(head, 0, 12, 0);
		if (mimeType === "video/webm")
			return (
				head[0] === 0x1a &&
				head[1] === 0x45 &&
				head[2] === 0xdf &&
				head[3] === 0xa3
			);
		const box = String.fromCharCode(...head.slice(4, 8));
		return (
			box === "ftyp" ||
			box === "moov" ||
			box === "mdat" ||
			box === "wide" ||
			box === "free"
		);
	} finally {
		await fh.close();
	}
}

export async function getMedia(db: Database, id: string) {
	const [row] = await db.select().from(media).where(eq(media.id, id));
	return row ?? null;
}
