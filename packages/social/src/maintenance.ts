import { rm } from "node:fs/promises";

import type { Database } from "@autopost/db";
import {
	media,
	post,
	socialAccount,
	workerHeartbeat,
} from "@autopost/db/schema/social";
import { desc, eq, inArray, sql } from "drizzle-orm";

import { mediaAbsolutePath } from "./media";

/** Worker considerado parado se não bater por este tempo. */
export const WORKER_STALE_MS = 90_000;

export async function heartbeat(db: Database, workerId: string) {
	await db
		.insert(workerHeartbeat)
		.values({ id: workerId })
		.onConflictDoUpdate({
			target: workerHeartbeat.id,
			set: { beatAt: sql`now()` },
		});
}

export async function workerStatus(db: Database) {
	const [last] = await db
		.select()
		.from(workerHeartbeat)
		.orderBy(desc(workerHeartbeat.beatAt))
		.limit(1);
	const lastBeat = last?.beatAt ?? null;
	return {
		lastBeat,
		online: Boolean(
			lastBeat && Date.now() - lastBeat.getTime() < WORKER_STALE_MS,
		),
	};
}

/**
 * Remove vídeos que não servem mais (evita encher o disco):
 * - enviados e nunca usados em um post há mais de `orphanHours`;
 * - de posts já encerrados (publicados/falhos/cancelados) há mais de `retentionDays`.
 * Vídeos de posts agendados ou em publicação nunca são apagados.
 */
export async function cleanupMedia(
	db: Database,
	{ orphanHours = 24, retentionDays = 30 } = {},
) {
	const result = await db.execute<{ id: string; storage_path: string }>(sql`
		select m.id, m.storage_path from media m
		where (
			not exists (select 1 from post p where p.media_id = m.id)
			and m.created_at < now() - make_interval(hours => ${orphanHours})
		) or (
			exists (select 1 from post p where p.media_id = m.id)
			and not exists (
				select 1 from post p where p.media_id = m.id
				and (p.status in ('draft', 'scheduled', 'publishing') or p.scheduled_at > now() - make_interval(days => ${retentionDays}))
			)
		)
		limit 200`);
	const rows = result.rows;
	for (const row of rows)
		await rm(mediaAbsolutePath(row.storage_path), { force: true });
	if (rows.length)
		await db.delete(media).where(
			inArray(
				media.id,
				rows.map((r) => r.id),
			),
		);
	return rows.length;
}

/** Apaga posts, contas conectadas e vídeos de um usuário (exclusão de conta, LGPD). */
export async function deleteUserData(db: Database, userId: string) {
	const files = await db
		.select({ storagePath: media.storagePath })
		.from(media)
		.where(eq(media.userId, userId));
	await db.transaction(async (tx) => {
		await tx.delete(post).where(eq(post.userId, userId));
		await tx.delete(socialAccount).where(eq(socialAccount.connectedBy, userId));
		await tx.delete(media).where(eq(media.userId, userId));
	});
	for (const f of files)
		await rm(mediaAbsolutePath(f.storagePath), { force: true });
}
