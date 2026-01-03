DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'memberships_building_unit_user_unique'
    ) THEN
        ALTER TABLE "memberships" ADD CONSTRAINT "memberships_building_unit_user_unique" UNIQUE("building_id","unit_id","user_id");
    END IF;
END $$;