import { platformConfig, socialAccount } from "@autopost/db/schema/social";
import {
	getProvider,
	isPublicAppUrl,
	listProviderInfo,
	PLATFORM_IDS,
	redirectUri,
	saveAppCredentials,
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
				// Credenciais digitadas não provam posse da conta: não deixa sobrescrever a de outra pessoa.
				const [existing] = await context.db
					.select({ connectedBy: socialAccount.connectedBy })
					.from(socialAccount)
					.where(
						and(
							eq(socialAccount.platform, input.platform),
							eq(socialAccount.externalId, account.externalId),
						),
					);
				if (
					existing?.connectedBy &&
					existing.connectedBy !== context.session.user.id &&
					context.session.user.role !== "admin"
				)
					throw new Error(
						"essa conta já foi conectada por outra pessoa. Peça a um administrador.",
					);
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

/** Admin ou quem conectou a conta. */
async function assertCanManage(
	context: {
		db: Context["db"];
		session: { user: { id: string; role: string } };
	},
	accountId: string,
) {
	const [row] = await context.db
		.select({ connectedBy: socialAccount.connectedBy })
		.from(socialAccount)
		.where(eq(socialAccount.id, accountId));
	if (!row)
		throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada" });
	if (
		context.session.user.role !== "admin" &&
		row.connectedBy !== context.session.user.id
	)
		throw new ORPCError("FORBIDDEN", {
			message:
				"Só quem conectou esta conta ou um administrador pode alterá-la.",
		});
}
