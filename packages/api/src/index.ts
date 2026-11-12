import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({
		context: {
			session: context.session,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export const TRIAL_ENDED =
	"Seu período de teste terminou. Fale com a IA2S para continuar usando o Cast.";

/** Acesso vencido (fim do teste): pode ver e cancelar, mas não publicar nem agendar. */
export function accessExpired(user: { accessUntil?: Date | string | null }) {
	return Boolean(
		user.accessUntil && new Date(user.accessUntil).getTime() < Date.now(),
	);
}

export const activeProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		if (accessExpired(context.session.user))
			throw new ORPCError("FORBIDDEN", { message: TRIAL_ENDED });
		return next();
	},
);

export const adminProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		if (context.session.user.role !== "admin") {
			throw new ORPCError("FORBIDDEN", {
				message: "Apenas administradores podem fazer isso.",
			});
		}
		return next();
	},
);
