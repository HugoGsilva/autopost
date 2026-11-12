import type { Database } from "@autopost/db";
import * as schema from "@autopost/db/schema/auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { sql } from "drizzle-orm";

export type AuthConfig = {
	BETTER_AUTH_URL: string;
	BETTER_AUTH_SECRET: string;
};

/** Dias de teste grátis para quem se cadastra sozinho. */
export const TRIAL_DAYS = 7;

const TERMS_REQUIRED =
	"Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.";

export function createAuth(env: AuthConfig, database: Database) {
	const userCount = async () => {
		const result = await database.execute<{ n: number }>(
			sql`select count(*)::int as n from "user"`,
		);
		return result.rows[0]?.n ?? 0;
	};
	// Opcional: trava o primeiro cadastro (admin) a um e-mail específico, evitando "tomada" do setup.
	const setupEmail = process.env.SETUP_ADMIN_EMAIL?.trim().toLowerCase();
	const trustedProxies = process.env.TRUSTED_PROXIES?.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	return betterAuth({
		database: drizzleAdapter(database, {
			provider: "pg",
			schema,
		}),
		trustedOrigins: [env.BETTER_AUTH_URL],
		emailAndPassword: { enabled: true, minPasswordLength: 8 },
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: trustedProxies?.length
			? { ipAddress: { trustedProxies } }
			: undefined,
		user: {
			additionalFields: {
				role: { type: "string", defaultValue: "member", input: false },
				accessUntil: { type: "date", required: false, input: false },
				termsAcceptedAt: { type: "date", required: false, input: false },
			},
		},
		// Cadastro aberto: limita contas novas por IP para segurar abuso.
		rateLimit: {
			enabled: process.env.NODE_ENV === "production",
			customRules: {
				"/sign-up/email": {
					window: 3600,
					max: Number(process.env.SIGNUP_RATE_LIMIT) || 5,
				},
			},
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-up/email") return;
				const body = ctx.body as
					| { email?: string; acceptTerms?: boolean }
					| undefined;
				if (body?.acceptTerms !== true)
					throw new APIError("BAD_REQUEST", { message: TERMS_REQUIRED });
				const email = String(body?.email ?? "").toLowerCase();
				if (setupEmail && email !== setupEmail && (await userCount()) === 0)
					throw new APIError("FORBIDDEN", {
						message: "Use o e-mail de administrador definido na instalação.",
					});
			}),
		},
		databaseHooks: {
			user: {
				create: {
					// O primeiro cadastro vira admin sem prazo; os demais entram no teste grátis.
					before: async (user) => {
						const first = (await userCount()) === 0;
						return {
							data: {
								...user,
								role: first ? "admin" : "member",
								accessUntil: first
									? null
									: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
								termsAcceptedAt: new Date(),
							},
						};
					},
				},
			},
		},
		plugins: [nextCookies()],
	});
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
