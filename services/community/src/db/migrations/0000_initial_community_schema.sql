-- Create enums with idempotency
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
        CREATE TYPE "public"."membership_status" AS ENUM('pending', 'verified', 'rejected');
    END IF;
END $$;--> statement-breakpoint
-- Add missing enum values if enum was created by another service with fewer values
DO $$ 
BEGIN
  -- Add 'pending' if it doesn't exist
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') AND
     NOT EXISTS (
       SELECT 1 FROM pg_enum 
       WHERE enumlabel = 'pending' 
       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'membership_status')
     ) THEN
    ALTER TYPE "public"."membership_status" ADD VALUE 'pending';
  END IF;
  
  -- Add 'rejected' if it doesn't exist  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') AND
     NOT EXISTS (
       SELECT 1 FROM pg_enum 
       WHERE enumlabel = 'rejected' 
       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'membership_status')
     ) THEN
    ALTER TYPE "public"."membership_status" ADD VALUE 'rejected';
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_in_building') THEN
        CREATE TYPE "public"."role_in_building" AS ENUM('resident', 'admin');
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
        CREATE TYPE "public"."post_status" AS ENUM('active', 'deleted');
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comment_status') THEN
        CREATE TYPE "public"."comment_status" AS ENUM('active', 'deleted');
    END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "building_memberships_projection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"unit_id" uuid,
	"role_in_building" "role_in_building" NOT NULL,
	"status" "membership_status" DEFAULT 'verified' NOT NULL,
	"verified_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projection_user_building_unique" UNIQUE("user_id","building_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"title" varchar(120),
	"content" text NOT NULL,
	"status" "post_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"status" "comment_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(255) NOT NULL,
	"version" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "processed_events" (
	"event_id" varchar(255) PRIMARY KEY NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_post_id_posts_id_fk') THEN
        ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projection_user_id_idx" ON "building_memberships_projection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projection_building_id_idx" ON "building_memberships_projection" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projection_user_building_idx" ON "building_memberships_projection" USING btree ("user_id","building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_building_id_idx" ON "posts" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_created_by_user_id_idx" ON "posts" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_building_status_idx" ON "posts" USING btree ("building_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_post_id_idx" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_building_id_idx" ON "comments" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_created_by_user_id_idx" ON "comments" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_created_at_idx" ON "comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_post_status_idx" ON "comments" USING btree ("post_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processed_events_processed_at_idx" ON "processed_events" USING btree ("processed_at");

