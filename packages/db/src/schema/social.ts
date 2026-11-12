import { defineRelationsPart } from "drizzle-orm";
import {
	bigint,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const postStatus = pgEnum("post_status", [
	"draft",
	"scheduled",
	"publishing",
	"published",
	"partial",
	"failed",
	"canceled",
]);

export const targetStatus = pgEnum("target_status", [
	"pending",
	"processing",
	"published",
	"failed",
	"canceled",
]);

/** Credenciais do app de desenvolvedor de cada plataforma (configuradas pela interface). */
export const platformConfig = pgTable("platform_config", {
	platform: text("platform").primaryKey(),
	clientId: text("client_id").notNull(),
	/** Segredo criptografado (AES-256-GCM). */
	clientSecret: text("client_secret").notNull(),
	extra: jsonb("extra").$type<Record<string, string>>().default({}).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const socialAccount = pgTable(
	"social_account",
	{
		id: text("id").primaryKey(),
		platform: text("platform").notNull(),
		externalId: text("external_id").notNull(),
		name: text("name").notNull(),
		username: text("username"),
		avatarUrl: text("avatar_url"),
		/** Tokens/credenciais criptografados (JSON). */
		credentials: text("credentials").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		meta: jsonb("meta").$type<Record<string, unknown>>().default({}).notNull(),
		status: text("status")
			.$type<"active" | "expired" | "error">()
			.default("active")
			.notNull(),
		lastError: text("last_error"),
		/** Dono da conta: só ele a vê e publica nela. */
		connectedBy: text("connected_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("social_account_platform_external_idx").on(
			t.platform,
			t.externalId,
		),
	],
);

/** Batimento do worker: a interface avisa se o serviço de publicação parou. */
export const workerHeartbeat = pgTable("worker_heartbeat", {
	id: text("id").primaryKey(),
	beatAt: timestamp("beat_at", { withTimezone: true }).defaultNow().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const media = pgTable("media", {
	id: text("id").primaryKey(),
	userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
	fileName: text("file_name").notNull(),
	storagePath: text("storage_path").notNull(),
	mimeType: text("mime_type").notNull(),
	size: bigint("size", { mode: "number" }).notNull(),
	durationSec: integer("duration_sec"),
	width: integer("width"),
	height: integer("height"),
	/** Token para a URL pública usada por plataformas que baixam o vídeo (Instagram, Threads...). */
	publicToken: text("public_token").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const post = pgTable(
	"post",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
		mediaId: text("media_id").references(() => media.id, {
			onDelete: "set null",
		}),
		caption: text("caption").default("").notNull(),
		status: postStatus("status").default("scheduled").notNull(),
		scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [index("post_scheduled_idx").on(t.scheduledAt)],
);

export type TargetOptions = {
	title?: string;
	privacy?: string;
	boardId?: string;
	mode?: "direct" | "inbox";
	[k: string]: unknown;
};

export const postTarget = pgTable(
	"post_target",
	{
		id: text("id").primaryKey(),
		postId: text("post_id")
			.notNull()
			.references(() => post.id, { onDelete: "cascade" }),
		accountId: text("account_id")
			.notNull()
			.references(() => socialAccount.id, { onDelete: "cascade" }),
		caption: text("caption"),
		options: jsonb("options").$type<TargetOptions>().default({}).notNull(),
		status: targetStatus("status").default("pending").notNull(),
		runAt: timestamp("run_at", { withTimezone: true }).notNull(),
		attempts: integer("attempts").default(0).notNull(),
		lockedAt: timestamp("locked_at", { withTimezone: true }),
		externalId: text("external_id"),
		externalUrl: text("external_url"),
		error: text("error"),
		/** Aviso não fatal (ex.: TikTok publicou como privado). */
		note: text("note"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index("post_target_due_idx").on(t.status, t.runAt),
		index("post_target_post_idx").on(t.postId),
	],
);

export const socialRelations = defineRelationsPart(
	{ socialAccount, media, post, postTarget, user },
	(r) => ({
		post: {
			media: r.one.media({ from: r.post.mediaId, to: r.media.id }),
			targets: r.many.postTarget({ from: r.post.id, to: r.postTarget.postId }),
			author: r.one.user({ from: r.post.userId, to: r.user.id }),
		},
		postTarget: {
			post: r.one.post({
				from: r.postTarget.postId,
				to: r.post.id,
				optional: false,
			}),
			account: r.one.socialAccount({
				from: r.postTarget.accountId,
				to: r.socialAccount.id,
				optional: false,
			}),
		},
		socialAccount: {
			targets: r.many.postTarget({
				from: r.socialAccount.id,
				to: r.postTarget.accountId,
			}),
		},
	}),
);
