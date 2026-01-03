-- Add 'delivered' status to delivery_status enum (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'delivered' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_status')
    ) THEN
        ALTER TYPE "public"."delivery_status" ADD VALUE 'delivered' BEFORE 'failed';
    END IF;
END $$;