import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { getMedia, mediaAbsolutePath } from "@autopost/social";
import type { NextRequest } from "next/server";

import { db } from "@/services";

/**
 * URL pública (protegida por token) do vídeo. Plataformas como Instagram/Threads baixam por aqui,
 * e a própria interface usa para o preview. Suporta Range (streaming/seek).
 */
async function serve(
	req: NextRequest,
	ctx: RouteContext<"/api/media/[id]/[token]/[name]">,
	head = false,
) {
	const { id, token } = await ctx.params;
	const row = await getMedia(db, id);
	if (!row || row.publicToken !== token)
		return new Response("Não encontrado", { status: 404 });

	const path = mediaAbsolutePath(row.storagePath);
	const size = await stat(path)
		.then((s) => s.size)
		.catch(() => null);
	if (size === null) return new Response("Arquivo removido", { status: 410 });

	const base = {
		"Content-Type": row.mimeType,
		"Accept-Ranges": "bytes",
		"Cache-Control": "private, max-age=3600",
		"Content-Disposition": `inline; filename="${row.fileName}"`,
	};
	const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
	if (!range) {
		return new Response(
			head ? null : (Readable.toWeb(createReadStream(path)) as ReadableStream),
			{
				headers: { ...base, "Content-Length": String(size) },
			},
		);
	}
	let start = range[1] ? Number(range[1]) : 0;
	let end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
	if (!range[1] && range[2]) {
		start = Math.max(0, size - Number(range[2]));
		end = size - 1;
	}
	if (start > end || start >= size)
		return new Response(null, {
			status: 416,
			headers: { "Content-Range": `bytes */${size}` },
		});
	return new Response(
		head
			? null
			: (Readable.toWeb(
					createReadStream(path, { start, end }),
				) as ReadableStream),
		{
			status: 206,
			headers: {
				...base,
				"Content-Length": String(end - start + 1),
				"Content-Range": `bytes ${start}-${end}/${size}`,
			},
		},
	);
}

export function GET(
	req: NextRequest,
	ctx: RouteContext<"/api/media/[id]/[token]/[name]">,
) {
	return serve(req, ctx);
}

export function HEAD(
	req: NextRequest,
	ctx: RouteContext<"/api/media/[id]/[token]/[name]">,
) {
	return serve(req, ctx, true);
}
