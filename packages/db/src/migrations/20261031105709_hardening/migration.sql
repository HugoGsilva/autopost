CREATE TABLE "worker_heartbeat" (
	"id" text PRIMARY KEY,
	"beat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_target" ADD COLUMN "note" text;