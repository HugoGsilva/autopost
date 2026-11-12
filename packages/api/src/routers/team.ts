import { account, session, user } from "@autopost/db/schema/auth";
import { deleteUserData, randomToken } from "@autopost/social";
import { ORPCError } from "@orpc/server";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import z from "zod";

import { adminProcedure, protectedProcedure, publicProcedure } from "../index";

export const teamRouter = {
	/** Usado pela tela de login: sem usuários, mostra o cadastro do primeiro admin. */
	setupStatus: publicProcedure.handler(async ({ context }) => {
		const [row] = await context.db
			.select({ n: sql<number>`count(*)::int` })
			.from(user);
		return { hasUsers: (row?.n ?? 0) > 0 };
	}),

	list: adminProcedure.handler(({ context }) =>
		context.db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				accessUntil: user.accessUntil,
				createdAt: user.createdAt,
			})
			.from(user)
			.orderBy(asc(user.createdAt)),
	),

	create: adminProcedure
		.input(
			z.object({
				name: z.string().trim().min(2),
				email: z.email().transform((e) => e.toLowerCase()),
				password: z
					.string()
					.min(8, "A senha precisa de pelo menos 8 caracteres"),
				role: z.enum(["admin", "member"]).default("member"),
			}),
		)
		.handler(async ({ context, input }) => {
			const [exists] = await context.db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, input.email));
			if (exists)
				throw new ORPCError("CONFLICT", {
					message: "Já existe um usuário com esse e-mail",
				});
			const id = randomToken(16);
			await context.db.transaction(async (tx) => {
				await tx.insert(user).values({
					id,
					name: input.name,
					email: input.email,
					role: input.role,
					emailVerified: true,
				});
				await tx.insert(account).values({
					id: randomToken(16),
					accountId: id,
					providerId: "credential",
					userId: id,
					password: await hashPassword(input.password),
				});
			});
			return { id };
		}),

	setRole: adminProcedure
		.input(z.object({ id: z.string(), role: z.enum(["admin", "member"]) }))
		.handler(async ({ context, input }) => {
			if (input.id === context.session.user.id)
				throw new ORPCError("BAD_REQUEST", {
					message: "Você não pode mudar o próprio papel",
				});
			await context.db
				.update(user)
				.set({ role: input.role })
				.where(eq(user.id, input.id));
			return { ok: true };
		}),

	/** Prazo de acesso de um cliente: data nova, ou null para liberar sem prazo. */
	setAccess: adminProcedure
		.input(z.object({ id: z.string(), until: z.coerce.date().nullable() }))
		.handler(async ({ context, input }) => {
			if (input.id === context.session.user.id)
				throw new ORPCError("BAD_REQUEST", {
					message: "Você não pode mudar o próprio acesso",
				});
			await context.db
				.update(user)
				.set({
					accessUntil: input.until,
					// Estender o acesso dá um novo saldo de posts; encerrar mantém o histórico.
					...(!input.until || input.until > new Date()
						? { trialPosts: 0 }
						: {}),
				})
				.where(eq(user.id, input.id));
			return { ok: true };
		}),

	/** Exclusão da própria conta pelo usuário (LGPD): pede a senha para confirmar. */
	deleteMe: protectedProcedure
		.input(z.object({ password: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const me = context.session.user;
			if (me.role === "admin")
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Administradores não podem excluir a própria conta. Peça a outro administrador.",
				});
			const [cred] = await context.db
				.select({ password: account.password })
				.from(account)
				.where(
					and(eq(account.userId, me.id), eq(account.providerId, "credential")),
				);
			if (
				!cred?.password ||
				!(await verifyPassword({ hash: cred.password, password: input.password }))
			)
				throw new ORPCError("BAD_REQUEST", { message: "Senha incorreta" });
			await deleteUserData(context.db, me.id);
			await context.db.delete(user).where(eq(user.id, me.id));
			return { ok: true };
		}),

	resetPassword: adminProcedure
		.input(
			z.object({
				id: z.string(),
				password: z
					.string()
					.min(8, "A senha precisa de pelo menos 8 caracteres"),
			}),
		)
		.handler(async ({ context, input }) => {
			const hash = await hashPassword(input.password);
			const updated = await context.db
				.update(account)
				.set({ password: hash })
				.where(
					and(
						eq(account.userId, input.id),
						eq(account.providerId, "credential"),
					),
				)
				.returning({ id: account.id });
			if (!updated.length)
				throw new ORPCError("NOT_FOUND", {
					message: "Usuário sem senha cadastrada",
				});
			// Derruba as sessões abertas com a senha antiga
			await context.db.delete(session).where(eq(session.userId, input.id));
			return { ok: true };
		}),

	remove: adminProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ context, input }) => {
			if (input.id === context.session.user.id)
				throw new ORPCError("BAD_REQUEST", {
					message: "Você não pode remover a si mesmo",
				});
			await deleteUserData(context.db, input.id);
			await context.db.delete(user).where(eq(user.id, input.id));
			return { ok: true };
		}),
};
