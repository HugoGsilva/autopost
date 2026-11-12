ALTER TABLE "user" ADD COLUMN "trial_posts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "user" SET "trial_posts" = (SELECT count(*) FROM "post" WHERE "post"."user_id" = "user"."id");