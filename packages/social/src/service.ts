import type { Database } from "@autopost/db";
import { platformConfig, socialAccount } from "@autopost/db/schema/social";
import { and, eq, inArray, sql } from "drizzle-orm";

import {
	decrypt,
	decryptJson,
	encrypt,
	encryptJson,
	randomToken,
} from "./crypto";
import { appUrl } from "./env";
import type {
	AccountForPublish,
	AppCredentials,
	ConnectedAccount,
	Credentials,
	PlatformId,
} from "./types";

export function redirectUri(platform: string): string {
	return `${appUrl()}/api/connect/${platform}/callback`;
}

export async function getAppCredentials(
	db: Database,
	platform: string,
): Promise<AppCredentials | null> {
	const [row] = await db
		.select()
		.from(platformConfig)
		.where(eq(platformConfig.platform, platform));
	if (!row) return null;
	return {
		clientId: row.clientId,
		clientSecret: decrypt(row.clientSecret),
		extra: row.extra,
	};
}

export async function saveAppCredentials(
	db: Database,
	platform: string,
	input: { clientId: string; clientSecret?: string },
) {
	const existing = await db
		.select()
		.from(platformConfig)
		.where(eq(platformConfig.platform, platform));
	const secret = input.clientSecret
		? encrypt(input.clientSecret)
		: existing[0]?.clientSecret;
	if (!secret) throw new Error("Informe o segredo do app");
	await db
		.insert(platformConfig)
		.values({ platform, clientId: input.clientId, clientSecret: secret })
		.onConflictDoUpdate({
			target: platformConfig.platform,
			set: { clientId: input.clientId, clientSecret: secret },
		});
}

export const ACCOUNT_TAKEN =
	"essa conta já está conectada em outro cadastro do Cast.";

/** Insere ou atualiza (reconexão) as contas retornadas pela plataforma. */
export async function upsertAccounts(
	db: Database,
	platform: PlatformId,
	accounts: ConnectedAccount[],
	userId: string,
) {
	if (!accounts.length) return [];
	// Cada conta da rede pertence a um só cadastro: ninguém sobrescreve a conta de outra pessoa.
	const taken = await db
		.select({ connectedBy: socialAccount.connectedBy })
		.from(socialAccount)
		.where(
			and(
				eq(socialAccount.platform, platform),
				inArray(
					socialAccount.externalId,
					accounts.map((a) => a.externalId),
				),
			),
		);
	if (taken.some((t) => t.connectedBy && t.connectedBy !== userId))
		throw new Error(ACCOUNT_TAKEN);
	const ids: string[] = [];
	for (const a of accounts) {
		const values = {
			name: a.name,
			username: a.username ?? null,
			avatarUrl: a.avatarUrl ?? null,
			credentials: encryptJson(a.credentials),
			expiresAt: a.expiresAt ?? null,
			meta: a.meta ?? {},
			status: "active" as const,
			lastError: null,
		};
		const [row] = await db
			.insert(socialAccount)
			.values({
				id: randomToken(12),
				platform,
				externalId: a.externalId,
				connectedBy: userId,
				...values,
			})
			.onConflictDoUpdate({
				target: [socialAccount.platform, socialAccount.externalId],
				set: { ...values, connectedBy: userId },
			})
			.returning({ id: socialAccount.id });
		if (row) ids.push(row.id);
	}
	return ids;
}

export function toPublishAccount(
	row: typeof socialAccount.$inferSelect,
): AccountForPublish {
	return {
		externalId: row.externalId,
		name: row.name,
		username: row.username,
		credentials: decryptJson<Credentials>(row.credentials),
		meta: row.meta,
	};
}

export async function updateAccountCredentials(
	db: Database,
	id: string,
	credentials: Credentials,
	expiresAt: Date | null,
) {
	await db
		.update(socialAccount)
		.set({
			credentials: encryptJson(credentials),
			expiresAt,
			status: "active",
			lastError: null,
		})
		.where(eq(socialAccount.id, id));
}

export async function markAccountError(
	db: Database,
	id: string,
	message: string,
	status: "expired" | "error",
) {
	await db
		.update(socialAccount)
		.set({ status, lastError: message })
		.where(and(eq(socialAccount.id, id)));
}

export async function countAccounts(db: Database) {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(socialAccount);
	return row?.n ?? 0;
}
