import type { Database } from "@autopost/db";
import { user } from "@autopost/db/schema/auth";
import {
	media,
	post,
	postTarget,
	socialAccount,
} from "@autopost/db/schema/social";
import { eq, sql } from "drizzle-orm";

import { ProviderError } from "./http";
import { mediaAbsolutePath, mediaPublicUrl } from "./media";
import { getProvider } from "./registry";
import {
	getAppCredentials,
	markAccountError,
	toPublishAccount,
	updateAccountCredentials,
} from "./service";

export const MAX_ATTEMPTS = 3;
const STALE_LOCK = "5 minutes";

type Logger = (msg: string) => void;

/** Reserva alvos vencidos de forma atômica (vários workers podem rodar juntos). */
export async function claimDueTargets(
	db: Database,
	limit = 5,
): Promise<string[]> {
	const result = await db.execute<{ id: string }>(sql`
		update post_target set status = 'processing', locked_at = now(), attempts = attempts + 1
		where id in (
			select t.id from post_target t
			join post p on p.id = t.post_id
			where p.status <> 'draft' and p.status <> 'canceled' and (
				(t.status = 'pending' and t.run_at <= now())
				or (t.status = 'processing' and t.locked_at < now() - interval '${sql.raw(STALE_LOCK)}')
			)
			order by t.run_at
			limit ${limit}
			for update of t skip locked
		)
		returning id`);
	return result.rows.map((r) => r.id);
}

/** Recalcula o status agregado do post a partir dos destinos. */
export async function refreshPostStatus(db: Database, postId: string) {
	const rows = await db
		.select({ status: postTarget.status })
		.from(postTarget)
		.where(eq(postTarget.postId, postId));
	const s = rows.map((r) => r.status).filter((x) => x !== "canceled");
	let status: typeof post.$inferSelect.status;
	if (!s.length) status = "canceled";
	else if (s.every((x) => x === "published")) status = "published";
	else if (s.some((x) => x === "processing" || x === "pending"))
		status = s.some((x) => x !== "pending") ? "publishing" : "scheduled";
	else if (s.some((x) => x === "published")) status = "partial";
	else status = "failed";
	await db.update(post).set({ status }).where(eq(post.id, postId));
	return status;
}

export function retryDelayMs(attempt: number): number {
	return [60_000, 5 * 60_000, 15 * 60_000][attempt - 1] ?? 15 * 60_000;
}

export async function processTarget(
	db: Database,
	targetId: string,
	log: Logger = () => {},
) {
	const [row] = await db
		.select({
			target: postTarget,
			post,
			account: socialAccount,
			media,
			accessUntil: user.accessUntil,
		})
		.from(postTarget)
		.innerJoin(post, eq(post.id, postTarget.postId))
		.leftJoin(user, eq(user.id, post.userId))
		.innerJoin(socialAccount, eq(socialAccount.id, postTarget.accountId))
		.leftJoin(media, eq(media.id, post.mediaId))
		.where(eq(postTarget.id, targetId));
	if (!row) return;
	const { target, account } = row;
	const tag = `[${account.platform}:${account.name}]`;
	const logs: string[] = [];
	const say = (m: string) => {
		logs.push(m);
		log(`${tag} ${m}`);
	};

	// Renova o lock enquanto publica: uploads longos não são "roubados" por outro worker.
	const keepAlive = setInterval(() => {
		db.update(postTarget)
			.set({ lockedAt: new Date() })
			.where(eq(postTarget.id, target.id))
			.catch(() => {});
	}, 60_000);

	try {
		if (row.accessUntil && row.accessUntil.getTime() < Date.now())
			throw new ProviderError(
				"Período de teste encerrado: fale com a IA2S para continuar publicando.",
				undefined,
				false,
			);
		if (!row.media) throw new ProviderError("Post sem vídeo");
		const provider = getProvider(account.platform);
		const app =
			provider.auth === "oauth"
				? await getAppCredentials(db, account.platform)
				: null;
		if (provider.auth === "oauth" && !app)
			throw new ProviderError(`${provider.name} não está configurado`);

		let acc = toPublishAccount(account);
		const expiresSoon =
			account.expiresAt &&
			account.expiresAt.getTime() - Date.now() <
				(provider.refreshWindowMs ?? 5 * 60_000);
		if (expiresSoon && provider.refresh) {
			const refreshed = await provider.refresh(acc, app).catch((e: Error) => {
				throw new ProviderError(
					`Conexão expirada — reconecte a conta (${e.message})`,
					401,
				);
			});
			if (refreshed) {
				await updateAccountCredentials(
					db,
					account.id,
					refreshed.credentials,
					refreshed.expiresAt,
				);
				acc = { ...acc, credentials: refreshed.credentials };
				say("Token renovado");
			}
		}

		const result = await provider.publish({
			account: acc,
			media: {
				path: mediaAbsolutePath(row.media.storagePath),
				size: row.media.size,
				mimeType: row.media.mimeType,
				fileName: row.media.fileName,
				publicUrl: mediaPublicUrl(row.media),
				durationSec: row.media.durationSec,
				width: row.media.width,
				height: row.media.height,
			},
			caption: target.caption ?? row.post.caption,
			options: target.options,
			app,
			log: say,
		});

		await db
			.update(postTarget)
			.set({
				status: "published",
				externalId: result.externalId,
				externalUrl: result.url ?? null,
				note: result.note ?? null,
				error: null,
				publishedAt: new Date(),
				lockedAt: null,
			})
			.where(eq(postTarget.id, target.id));
		say(`Publicado ✓ ${result.url ?? result.externalId}`);
	} catch (err) {
		const e = err as Error;
		const status = err instanceof ProviderError ? err.status : undefined;
		const retryable = err instanceof ProviderError ? err.retryable : true;
		const willRetry = retryable && target.attempts < MAX_ATTEMPTS;
		if (status === 401)
			await markAccountError(db, account.id, e.message, "expired");
		await db
			.update(postTarget)
			.set({
				status: willRetry ? "pending" : "failed",
				runAt: willRetry
					? new Date(Date.now() + retryDelayMs(target.attempts))
					: target.runAt,
				error: e.message,
				lockedAt: null,
			})
			.where(eq(postTarget.id, target.id));
		say(`Erro${willRetry ? " (vai tentar de novo)" : ""}: ${e.message}`);
	} finally {
		clearInterval(keepAlive);
		await refreshPostStatus(db, target.postId);
	}
}

/** Um ciclo do worker: reserva e processa em paralelo. */
export async function tick(
	db: Database,
	log: Logger = console.log,
	concurrency = 4,
) {
	const ids = await claimDueTargets(db, concurrency);
	await Promise.all(ids.map((id) => processTarget(db, id, log)));
	return ids.length;
}
