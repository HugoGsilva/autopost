import { accessExpired, TRIAL_ENDED } from "@autopost/api";
import {
	ALLOWED_VIDEO_TYPES,
	mediaPublicUrl,
	mediaUsageBytes,
	saveUpload,
} from "@autopost/social";
import type { NextRequest } from "next/server";

import { TRIAL } from "@/lib/site";
import { auth, db } from "@/services";

const TRIAL_STORAGE_BYTES = TRIAL.storageGb * 1024 ** 3;

const num = (v: string | null) =>
	v && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null;

/** Upload do vídeo como corpo bruto (stream direto para o disco). Metadados vão nos headers. */
export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session?.user)
		return Response.json({ error: "Não autenticado" }, { status: 401 });
	if (accessExpired(session.user))
		return Response.json({ error: TRIAL_ENDED }, { status: 403 });
	// Teste grátis: o content-length só serve para recusar cedo; o teto real é
	// aplicado nos bytes gravados (um envio sem content-length passaria daqui).
	let limit: { bytes: number; message: string } | undefined;
	if (session.user.accessUntil) {
		const message = `O teste grátis tem ${TRIAL.storageGb} GB para vídeos. Fale com a IA2S para continuar.`;
		const left =
			TRIAL_STORAGE_BYTES - (await mediaUsageBytes(db, session.user.id));
		const incoming = Number(req.headers.get("content-length")) || 0;
		if (left <= 0 || incoming > left)
			return Response.json({ error: message }, { status: 413 });
		limit = { bytes: left, message };
	}

	const mimeType = (req.headers.get("content-type") ?? "")
		.split(";")[0]!
		.trim();
	if (!ALLOWED_VIDEO_TYPES.includes(mimeType))
		return Response.json(
			{ error: "Formato não suportado. Use MP4, MOV ou WebM." },
			{ status: 415 },
		);
	if (!req.body)
		return Response.json({ error: "Arquivo vazio" }, { status: 400 });

	try {
		const row = await saveUpload(db, {
			stream: req.body,
			fileName: decodeURIComponent(
				req.headers.get("x-file-name") ?? "video.mp4",
			),
			mimeType,
			userId: session.user.id,
			durationSec: num(req.headers.get("x-duration")),
			width: num(req.headers.get("x-width")),
			height: num(req.headers.get("x-height")),
			limit,
		});
		return Response.json({
			id: row.id,
			fileName: row.fileName,
			mimeType: row.mimeType,
			size: row.size,
			durationSec: row.durationSec,
			width: row.width,
			height: row.height,
			url: mediaPublicUrl(row),
		});
	} catch (err) {
		return Response.json({ error: (err as Error).message }, { status: 400 });
	}
}
