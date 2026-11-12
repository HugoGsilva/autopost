ALTER TABLE "user" ADD COLUMN "access_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "social_account" SET "connected_by" = (SELECT "id" FROM "user" WHERE "role" = 'admin' ORDER BY "created_at" LIMIT 1) WHERE "connected_by" IS NULL;--> statement-breakpoint
UPDATE "post" SET "user_id" = (SELECT "id" FROM "user" WHERE "role" = 'admin' ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "media" SET "user_id" = (SELECT "id" FROM "user" WHERE "role" = 'admin' ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;
