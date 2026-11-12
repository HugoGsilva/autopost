import { user } from "@autopost/db/schema/auth";
import {
	media,
	post,
	postTarget,
	socialAccount,
} from "@autopost/db/schema/social";
import {
	getProvider,
	humanizeError,
	isPublicAppUrl,
	mediaPublicUrl,
	randomToken,
	refreshPostStatus,
	tiktokPostProblems,
} from "@autopost/social";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import z from "zod";

import type { Context } from "../context";
import { activeProcedure, protectedProcedure } from "../index";

const targetInput = z.object({
	accountId: z.string(),
	caption: z.string().max(10_000).nullish(),
	options: z.record(z.string(), z.unknown()).default({}),
});

const createInput = z.object({
	mediaId: z.string(),
	caption: z.string().max(10_000).default(""),
	/** null = publicar agora */
	scheduledAt: z.coerce.date().nullish(),
	targets: z.array(targetInput).min(1, "Escolha pelo menos um destino"),
});

/** Teto de posts durante o teste grátis (protege o servidor de abuso). */
export const TRIAL_MAX_POSTS = 20;

const FORMAT_LABELS: Record<string, string> = {
	"video/mp4": "MP4",
	"video/quicktime": "MOV",
	"video/webm": "WebM",
};
export const formatLabel = (mime: string) => FORMAT_LABELS[mime] ?? mime;

/** Regras por plataforma: legenda, tamanho, duração, URL pública. Retorna a lista de problemas. */
export function validateTargets(
	targets: z.infer<typeof targetInput>[],
	accounts: (typeof socialAccount.$inferSelect)[],
	caption: string,
	file: typeof media.$inferSelect,
): string[] {
	const problems: string[] = [];
	for (const t of targets) {
		const acc = accounts.find((a) => a.id === t.accountId);
		if (!acc) {
			problems.push("Conta de destino não encontrada");
			continue;
		}
		const p = getProvider(acc.platform);
		const text = t.caption ?? caption;
		const label = `${p.name} (${acc.name})`;
		if (Array.from(text).length > p.captionLimit)
			problems.push(`${label}: legenda passa de ${p.captionLimit} caracteres`);
		if (!p.acceptedTypes.includes(file.mimeType))
			problems.push(
				`${label}: formato ${formatLabel(file.mimeType)} não é aceito (use ${p.acceptedTypes.map(formatLabel).join(" ou ")})`,
			);
		if (p.maxSizeMB && file.size > p.maxSizeMB * 1024 * 1024)
			problems.push(`${label}: vídeo maior que ${p.maxSizeMB} MB`);
		if (
			p.maxDurationSec &&
			file.durationSec &&
			file.durationSec > p.maxDurationSec
		)
			problems.push(
				`${label}: vídeo mais longo que ${Math.round(p.maxDurationSec / 60)} min`,
			);
		if (p.requiresPublicUrl && !isPublicAppUrl())
			problems.push(
				`${label}: precisa do sistema publicado num domínio https (o vídeo é baixado por URL)`,
			);
		if (acc.status === "expired")
			problems.push(`${label}: conexão expirada, reconecte a conta`);
		if (acc.platform === "tiktok")
			for (const issue of tiktokPostProblems(t.options))
				problems.push(`${label}: ${issue}`);
	}
	return problems;
}

async function loadPosts(
	db: Context["db"],
	where?: ReturnType<typeof and>,
	limit = 100,
) {
	const posts = await db
		.select()
		.from(post)
		.where(where)
		.orderBy(desc(post.scheduledAt))
		.limit(limit);
	if (!posts.length) return [];
	const ids = posts.map((p) => p.id);
	const mediaIds = posts
		.map((p) => p.mediaId)
		.filter((x): x is string => Boolean(x));
	const [targets, files] = await Promise.all([
		db
			.select({
				id: postTarget.id,
				postId: postTarget.postId,
				accountId: postTarget.accountId,
				caption: postTarget.caption,
				options: postTarget.options,
				status: postTarget.status,
				attempts: postTarget.attempts,
				error: postTarget.error,
				note: postTarget.note,
				externalUrl: postTarget.externalUrl,
				publishedAt: postTarget.publishedAt,
				runAt: postTarget.runAt,
				platform: socialAccount.platform,
				accountName: socialAccount.name,
				accountUsername: socialAccount.username,
				accountAvatar: socialAccount.avatarUrl,
			})
			.from(postTarget)
			.innerJoin(socialAccount, eq(socialAccount.id, postTarget.accountId))
			.where(inArray(postTarget.postId, ids)),
		mediaIds.length
			? db.select().from(media).where(inArray(media.id, mediaIds))
			: [],
	]);
	return posts.map((p) => {
		const file = files.find((f) => f.id === p.mediaId);
		return {
			...p,
			media: file
				? {
						id: file.id,
						fileName: file.fileName,
						mimeType: file.mimeType,
						size: file.size,
						durationSec: file.durationSec,
						width: file.width,
						height: file.height,
						url: mediaPublicUrl(file),
					}
				: null,
			targets: targets
				.filter((t) => t.postId === p.id)
				.map((t) => ({ ...t, errorInfo: humanizeError(t.error) })),
		};
	});
}

async function getOwnedPost(db: Context["db"], id: string, userId: string) {
	const [row] = await db
		.select()
		.from(post)
		.where(and(eq(post.id, id), eq(post.userId, userId)));
	if (!row)
		throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });
	return row;
}

async function getOwnedTarget(
	db: Context["db"],
	targetId: string,
	userId: string,
) {
	const [row] = await db
		.select({ target: postTarget })
		.from(postTarget)
		.innerJoin(post, eq(post.id, postTarget.postId))
		.where(and(eq(postTarget.id, targetId), eq(post.userId, userId)));
	if (!row) throw new ORPCError("NOT_FOUND");
	return row.target;
}

export const postsRouter = {
	create: activeProcedure
		.input(createInput)
		.handler(async ({ context, input }) => {
			const { db } = context;
			const userId = context.session.user.id;
			const [file] = await db
				.select()
				.from(media)
				.where(and(eq(media.id, input.mediaId), eq(media.userId, userId)));
			if (!file)
				throw new ORPCError("BAD_REQUEST", {
					message: "Vídeo não encontrado, envie novamente",
				});
			const accountIds = [...new Set(input.targets.map((t) => t.accountId))];
			const accounts = await db
				.select()
				.from(socialAccount)
				.where(
					and(
						inArray(socialAccount.id, accountIds),
						eq(socialAccount.connectedBy, userId),
					),
				);
			const problems = validateTargets(
				input.targets,
				accounts,
				input.caption,
				file,
			);
			if (problems.length)
				throw new ORPCError("BAD_REQUEST", {
					message: problems.join(" • "),
					data: { problems },
				});

			const when =
				input.scheduledAt && input.scheduledAt.getTime() > Date.now()
					? input.scheduledAt
					: new Date();
			const postId = randomToken(12);
			await db.transaction(async (tx) => {
				// Teste grátis: reserva o saldo na mesma transação (atômico, e apagar não devolve).
				if (context.session.user.accessUntil) {
					const [slot] = await tx
						.update(user)
						.set({ trialPosts: sql`${user.trialPosts} + 1` })
						.where(
							and(eq(user.id, userId), lt(user.trialPosts, TRIAL_MAX_POSTS)),
						)
						.returning({ id: user.id });
					if (!slot)
						throw new ORPCError("FORBIDDEN", {
							message: `O teste grátis permite até ${TRIAL_MAX_POSTS} posts. Fale com a IA2S para continuar.`,
						});
				}
				await tx.insert(post).values({
					id: postId,
					userId,
					mediaId: file.id,
					caption: input.caption,
					scheduledAt: when,
					status: "scheduled",
				});
				await tx.insert(postTarget).values(
					input.targets.map((t) => ({
						id: randomToken(12),
						postId,
						accountId: t.accountId,
						caption: t.caption ?? null,
						options: t.options,
						runAt: when,
					})),
				);
			});
			return { id: postId, scheduledAt: when, immediate: !input.scheduledAt };
		}),

	list: protectedProcedure
		.input(
			z
				.object({
					from: z.coerce.date().optional(),
					to: z.coerce.date().optional(),
					status: z
						.enum([
							"scheduled",
							"publishing",
							"published",
							"partial",
							"failed",
							"canceled",
						])
						.optional(),
					limit: z.number().int().min(1).max(500).default(100),
				})
				.default({ limit: 100 }),
		)
		.handler(({ context, input }) =>
			loadPosts(
				context.db,
				and(
					eq(post.userId, context.session.user.id),
					input.from ? gte(post.scheduledAt, input.from) : undefined,
					input.to ? lt(post.scheduledAt, input.to) : undefined,
					input.status ? eq(post.status, input.status) : undefined,
				),
				input.limit,
			),
		),

	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ context, input }) => {
			const [row] = await loadPosts(
				context.db,
				and(eq(post.id, input.id), eq(post.userId, context.session.user.id)),
				1,
			);
			if (!row)
				throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });
			return row;
		}),

	update: activeProcedure
		.input(
			z.object({
				id: z.string(),
				caption: z.string().max(10_000),
				scheduledAt: z.coerce.date(),
				/** Legenda personalizada por destino (null = usa a legenda geral). */
				targetCaptions: z
					.record(z.string(), z.string().max(10_000).nullable())
					.default({}),
			}),
		)
		.handler(async ({ context, input }) => {
			const p = await getOwnedPost(
				context.db,
				input.id,
				context.session.user.id,
			);
			if (p.status !== "scheduled")
				throw new ORPCError("BAD_REQUEST", {
					message: "Só dá para editar posts que ainda não começaram a sair",
				});
			if (input.scheduledAt.getTime() < Date.now() - 60_000)
				throw new ORPCError("BAD_REQUEST", {
					message: "Escolha um horário no futuro",
				});
			const targets = await context.db
				.select({
					id: postTarget.id,
					caption: postTarget.caption,
					platform: socialAccount.platform,
					name: socialAccount.name,
				})
				.from(postTarget)
				.innerJoin(socialAccount, eq(socialAccount.id, postTarget.accountId))
				.where(eq(postTarget.postId, p.id));
			const captionOf = (t: (typeof targets)[number]) =>
				t.id in input.targetCaptions
					? (input.targetCaptions[t.id] ?? input.caption)
					: (t.caption ?? input.caption);
			const problems = targets
				.filter(
					(t) =>
						Array.from(captionOf(t)).length >
						getProvider(t.platform).captionLimit,
				)
				.map(
					(t) =>
						`${getProvider(t.platform).name} (${t.name}): legenda passa de ${getProvider(t.platform).captionLimit} caracteres`,
				);
			if (problems.length)
				throw new ORPCError("BAD_REQUEST", { message: problems.join(" • ") });
			await context.db.transaction(async (tx) => {
				await tx
					.update(post)
					.set({ caption: input.caption, scheduledAt: input.scheduledAt })
					.where(eq(post.id, p.id));
				await tx
					.update(postTarget)
					.set({ runAt: input.scheduledAt })
					.where(
						and(eq(postTarget.postId, p.id), eq(postTarget.status, "pending")),
					);
				for (const [targetId, caption] of Object.entries(
					input.targetCaptions,
				)) {
					if (!targets.some((t) => t.id === targetId)) continue;
					await tx
						.update(postTarget)
						.set({ caption })
						.where(eq(postTarget.id, targetId));
				}
			});
			return { ok: true };
		}),

	/** Dados do vídeo de um post, para reaproveitar no compositor ("Usar de novo"). */
	media: protectedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ context, input }) => {
			const [file] = await context.db
				.select()
				.from(media)
				.where(
					and(eq(media.id, input.id), eq(media.userId, context.session.user.id)),
				);
			if (!file)
				throw new ORPCError("NOT_FOUND", {
					message:
						"Este vídeo não está mais disponível (foi removido pela limpeza automática).",
				});
			return {
				id: file.id,
				fileName: file.fileName,
				mimeType: file.mimeType,
				size: file.size,
				durationSec: file.durationSec,
				width: file.width,
				height: file.height,
				url: mediaPublicUrl(file),
			};
		}),

	cancelTarget: protectedProcedure
		.input(z.object({ targetId: z.string() }))
		.handler(async ({ context, input }) => {
			const t = await getOwnedTarget(
				context.db,
				input.targetId,
				context.session.user.id,
			);
			if (t.status !== "pending")
				throw new ORPCError("BAD_REQUEST", {
					message: "Esse destino já foi processado",
				});
			await context.db
				.update(postTarget)
				.set({ status: "canceled" })
				.where(eq(postTarget.id, t.id));
			await refreshPostStatus(context.db, t.postId);
			return { ok: true };
		}),

	reschedule: activeProcedure
		.input(z.object({ id: z.string(), scheduledAt: z.coerce.date() }))
		.handler(async ({ context, input }) => {
			const p = await getOwnedPost(
				context.db,
				input.id,
				context.session.user.id,
			);
			if (p.status !== "scheduled")
				throw new ORPCError("BAD_REQUEST", {
					message: "Só dá para remarcar posts agendados",
				});
			if (input.scheduledAt.getTime() < Date.now() - 60_000)
				throw new ORPCError("BAD_REQUEST", {
					message: "Escolha um horário no futuro",
				});
			await context.db.transaction(async (tx) => {
				await tx
					.update(post)
					.set({ scheduledAt: input.scheduledAt })
					.where(eq(post.id, p.id));
				await tx
					.update(postTarget)
					.set({ runAt: input.scheduledAt })
					.where(
						and(eq(postTarget.postId, p.id), eq(postTarget.status, "pending")),
					);
			});
			return { ok: true };
		}),

	publishNow: activeProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ context, input }) => {
			const p = await getOwnedPost(
				context.db,
				input.id,
				context.session.user.id,
			);
			if (p.status !== "scheduled")
				throw new ORPCError("BAD_REQUEST", {
					message: "Este post não está agendado",
				});
			const now = new Date();
			await context.db
				.update(post)
				.set({ scheduledAt: now })
				.where(eq(post.id, p.id));
			await context.db
				.update(postTarget)
				.set({ runAt: now })
				.where(
					and(eq(postTarget.postId, p.id), eq(postTarget.status, "pending")),
				);
			return { ok: true };
		}),

	cancel: protectedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ context, input }) => {
			const p = await getOwnedPost(
				context.db,
				input.id,
				context.session.user.id,
			);
			await context.db
				.update(postTarget)
				.set({ status: "canceled" })
				.where(
					and(eq(postTarget.postId, p.id), eq(postTarget.status, "pending")),
				);
			const status = await refreshPostStatus(context.db, p.id);
			return { status };
		}),

	retryTarget: activeProcedure
		.input(z.object({ targetId: z.string() }))
		.handler(async ({ context, input }) => {
			const t = await getOwnedTarget(
				context.db,
				input.targetId,
				context.session.user.id,
			);
			if (t.status !== "failed" && t.status !== "canceled")
				throw new ORPCError("BAD_REQUEST", {
					message: "Só dá para tentar de novo destinos com falha",
				});
			await context.db
				.update(postTarget)
				.set({ status: "pending", runAt: new Date(), attempts: 0, error: null })
				.where(eq(postTarget.id, t.id));
			await refreshPostStatus(context.db, t.postId);
			return { ok: true };
		}),

	remove: protectedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ context, input }) => {
			const p = await getOwnedPost(
				context.db,
				input.id,
				context.session.user.id,
			);
			if (p.status === "publishing")
				throw new ORPCError("BAD_REQUEST", {
					message: "Aguarde terminar de publicar",
				});
			await context.db.delete(post).where(eq(post.id, p.id));
			return { ok: true };
		}),

	stats: protectedProcedure.handler(async ({ context }) => {
		const { db } = context;
		const userId = context.session.user.id;
		const [counts] = await db
			.select({
				scheduled: sql<number>`count(*) filter (where ${post.status} = 'scheduled')::int`,
				publishing: sql<number>`count(*) filter (where ${post.status} = 'publishing')::int`,
				published7d: sql<number>`count(*) filter (where ${post.status} in ('published','partial') and ${post.scheduledAt} > now() - interval '7 days')::int`,
				failed7d: sql<number>`count(*) filter (where ${post.status} in ('failed','partial') and ${post.scheduledAt} > now() - interval '7 days')::int`,
			})
			.from(post)
			.where(eq(post.userId, userId));
		const [acc] = await db
			.select({ n: sql<number>`count(*)::int` })
			.from(socialAccount)
			.where(eq(socialAccount.connectedBy, userId));
		return { ...counts!, accounts: acc?.n ?? 0 };
	}),
};
