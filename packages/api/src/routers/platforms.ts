import { platformConfig, socialAccount } from "@autopost/db/schema/social";
import {
	freshAccount,
	getProvider,
	isPublicAppUrl,
	listProviderInfo,
	PLATFORM_IDS,
	redirectUri,
	markAccountError,
	ProviderError,
	saveAppCredentials,
	tiktokCreatorInfo,
	upsertAccounts,
} from "@autopost/social";
import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import type { Context } from "../context";
import { adminProcedure, protectedProcedure } from "../index";

const platformId = z.enum(PLATFORM_IDS);

/** A rede simulada só aparece em desenvolvimento ou com DEMO_ENABLED=true. */
const demoEnabled = () =>
	process.env.NODE_ENV !== "production" || process.env.DEMO_ENABLED === "true";

export const platformsRouter = {
	list: protectedProcedure.handler(async ({ context }) => {
		const configs = await context.db.select().from(platformConfig);
		const isAdmin = context.session.user.role === "admin";
		return {
			appUrlIsPublic: isPublicAppUrl(),
			platforms: listProviderInfo()
				.filter((p) => p.id !== "demo" || demoEnabled())
				.map((p) => {
					const cfg = configs.find((c) => c.platform === p.id);
					return {
						...p,
						configured: p.auth === "manual" || Boolean(cfg),
						redirectUri: redirectUri(p.id),
						clientId: isAdmin ? (cfg?.clientId ?? null) : null,
						configuredAt: cfg?.updatedAt ?? null,
					};
				}),
		};
	}),

	saveConfig: adminProcedure
		.input(
			z.object({
				platform: platformId,
				clientId: z.string().trim().min(1),
				clientSecret: z.string().trim().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			if (getProvider(input.platform).auth !== "oauth")
				throw new ORPCError("BAD_REQUEST");
			await saveAppCredentials(context.db, input.platform, input);
			return { ok: true };
		}),

	removeConfig: adminProcedure
		.input(z.object({ platform: platformId }))
		.handler(async ({ context, input }) => {
			await context.db
				.delete(platformConfig)
				.where(eq(platformConfig.platform, input.platform));
			return { ok: true };
		}),
};

const publicAccount = {
	id: socialAccount.id,
	connectedBy: socialAccount.connectedBy,
	platform: socialAccount.platform,
	name: socialAccount.name,
	username: socialAccount.username,
	avatarUrl: socialAccount.avatarUrl,
	status: socialAccount.status,
	lastError: socialAccount.lastError,
	expiresAt: socialAccount.expiresAt,
	meta: socialAccount.meta,
	createdAt: socialAccount.createdAt,
};

export const accountsRouter = {
	list: protectedProcedure.handler(({ context }) =>
		context.db
			.select(publicAccount)
			.from(socialAccount)
			.where(eq(socialAccount.connectedBy, context.session.user.id))
			.orderBy(socialAccount.platform, desc(socialAccount.createdAt)),
	),

	connectManual: protectedProcedure
		.input(
			z.object({
				platform: platformId,
				fields: z.record(z.string(), z.string()),
			}),
		)
		.handler(async ({ context, input }) => {
			const provider = getProvider(input.platform);
			if (!provider.connectManual)
				throw new ORPCError("BAD_REQUEST", {
					message: "Esta rede conecta via login.",
				});
			for (const f of provider.manualFields ?? []) {
				if (!f.optional && !input.fields[f.key]?.trim())
					throw new ORPCError("BAD_REQUEST", {
						message: `Preencha “${f.label}”.`,
					});
			}
			try {
				const account = await provider.connectManual(input.fields);
				const [id] = await upsertAccounts(
					context.db,
					input.platform,
					[account],
					context.session.user.id,
				);
				return { id, name: account.name };
			} catch (err) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Não foi possível conectar: ${(err as Error).message}`,
				});
			}
		}),

	/**
	 * Quem vai publicar e o que a conta permite (privacidade, interações, duração).
	 * O TikTok exige mostrar isso na tela antes de cada post direto.
	 */
	tiktokCreatorInfo: protectedProcedure
		.input(z.object({ accountId: z.string() }))
		.handler(async ({ context, input }) => {
			const [row] = await context.db
				.select()
				.from(socialAccount)
				.where(
					and(
						eq(socialAccount.id, input.accountId),
						eq(socialAccount.connectedBy, context.session.user.id),
						eq(socialAccount.platform, "tiktok"),
					),
				);
			if (!row)
				throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada" });
			try {
				const { acc } = await freshAccount(context.db, row);
				const info = await tiktokCreatorInfo(acc.credentials.accessToken!);
				return { ok: true as const, ...info };
			} catch (err) {
				const message = (err as Error).message;
				if (err instanceof ProviderError && err.status === 401)
					await markAccountError(context.db, row.id, message, "expired");
				return { ok: false as const, message: tiktokBlockMessage(message) };
			}
		}),

	rename: protectedProcedure
		.input(z.object({ id: z.string(), name: z.string().trim().min(1).max(80) }))
		.handler(async ({ context, input }) => {
			await assertCanManage(context, input.id);
			await context.db
				.update(socialAccount)
				.set({ name: input.name })
				.where(eq(socialAccount.id, input.id));
			return { ok: true };
		}),

	remove: protectedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ context, input }) => {
			await assertCanManage(context, input.id);
			await context.db
				.delete(socialAccount)
				.where(eq(socialAccount.id, input.id));
			return { ok: true };
		}),
};

/** Só o dono mexe na conta. */
async function assertCanManage(
	context: {
		db: Context["db"];
		session: { user: { id: string } };
	},
	accountId: string,
) {
	const [row] = await context.db
		.select({ connectedBy: socialAccount.connectedBy })
		.from(socialAccount)
		.where(eq(socialAccount.id, accountId));
	if (!row || row.connectedBy !== context.session.user.id)
		throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada" });
}

/** Erros do TikTok que impedem postar agora, em linguagem simples. */
function tiktokBlockMessage(raw: string) {
	if (raw.includes("spam_risk_too_many_posts"))
		return "Esta conta atingiu o limite de posts do TikTok por hoje. Tente novamente amanhã.";
	if (raw.includes("spam_risk_user_banned_from_posting"))
		return "O TikTok bloqueou novas publicações nesta conta.";
	if (raw.includes("reached_active_user_cap"))
		return "O TikTok atingiu o limite diário de contas que podem postar pelo Cast. Tente mais tarde.";
	if (/access_token|401|expirad/i.test(raw))
		return "A conexão com o TikTok expirou. Reconecte a conta em Contas.";
	return `O TikTok não liberou o post agora: ${raw}`;
}
