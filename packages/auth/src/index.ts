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

const SIGNUP_CLOSED =
	"Cadastro fechado. Peça a um administrador para criar seu acesso.";

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
			},
		},
		hooks: {
			// Roda antes da checagem de e-mail existente: não dá para descobrir e-mails da equipe pelo cadastro.
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-up/email") return;
				if ((await userCount()) > 0)
					throw new APIError("FORBIDDEN", { message: SIGNUP_CLOSED });
				const email = String(
					(ctx.body as { email?: string } | undefined)?.email ?? "",
				).toLowerCase();
				if (setupEmail && email !== setupEmail)
					throw new APIError("FORBIDDEN", {
						message: "Use o e-mail de administrador definido na instalação.",
					});
			}),
		},
		databaseHooks: {
			user: {
				create: {
					// Ferramenta interna: o primeiro cadastro vira admin; depois disso só o admin cria acessos.
					before: async (user) => {
						if ((await userCount()) > 0)
							throw new APIError("FORBIDDEN", { message: SIGNUP_CLOSED });
						return { data: { ...user, role: "admin" } };
					},
				},
			},
		},
		plugins: [nextCookies()],
	});
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
