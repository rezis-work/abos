-- Create enums (idempotent - errors handled by migrate.ts script)
CREATE TYPE "public"."role_in_building" AS ENUM('resident', 'admin');
--> statement-breakpoint
CREATE TYPE "public"."visitor_pass_status" AS ENUM('active', 'used', 'revoked');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "building_memberships_projection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"role" "role_in_building" NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_projection_user_building_unique" UNIQUE("user_id","building_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(255) NOT NULL,
	"version" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "processed_events" (
	"event_id" varchar(255) PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_processed_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visitor_pass_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_pass_id" uuid NOT NULL,
	"type" varchar(60) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visitor_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"visitor_name" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"status" "visitor_pass_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitor_pass_events_visitor_pass_id_visitor_passes_id_fk') THEN ALTER TABLE "visitor_pass_events" ADD CONSTRAINT "visitor_pass_events_visitor_pass_id_visitor_passes_id_fk" FOREIGN KEY ("visitor_pass_id") REFERENCES "public"."visitor_passes"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_projection_user_id_idx" ON "building_memberships_projection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_projection_building_id_idx" ON "building_memberships_projection" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_projection_user_building_idx" ON "building_memberships_projection" USING btree ("user_id","building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_processed_events_processed_at_idx" ON "processed_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_pass_events_visitor_pass_id_idx" ON "visitor_pass_events" USING btree ("visitor_pass_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_pass_events_type_idx" ON "visitor_pass_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_pass_events_created_at_idx" ON "visitor_pass_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_passes_building_id_idx" ON "visitor_passes" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_passes_resident_id_idx" ON "visitor_passes" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_passes_status_idx" ON "visitor_passes" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_passes_resident_building_idx" ON "visitor_passes" USING btree ("resident_id","building_id");