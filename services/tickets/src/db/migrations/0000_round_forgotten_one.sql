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
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_category') THEN
        CREATE TYPE "public"."ticket_category" AS ENUM('plumbing', 'electric', 'security', 'noise', 'other');
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
        CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');
    END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "building_memberships_projection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"role_in_building" "role_in_building" NOT NULL,
	"status" "membership_status" DEFAULT 'verified' NOT NULL,
	"verified_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projection_user_building_unit_unique" UNIQUE("user_id","building_id","unit_id")
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
CREATE TABLE IF NOT EXISTS "ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"type" varchar(60) NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"category" "ticket_category" NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"assigned_to_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_events_ticket_id_tickets_id_fk') THEN
        ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projection_user_id_idx" ON "building_memberships_projection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projection_building_id_idx" ON "building_memberships_projection" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projection_user_building_idx" ON "building_memberships_projection" USING btree ("user_id","building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processed_events_processed_at_idx" ON "processed_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_events_ticket_id_idx" ON "ticket_events" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_events_type_idx" ON "ticket_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_events_created_at_idx" ON "ticket_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_building_id_idx" ON "tickets" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_unit_id_idx" ON "tickets" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_created_by_user_id_idx" ON "tickets" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_assigned_to_user_id_idx" ON "tickets" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_building_status_idx" ON "tickets" USING btree ("building_id","status");
