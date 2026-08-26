ALTER TABLE IF EXISTS "airbrush" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "maintenance_log" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "shopping_list_item" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "spray_session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "vendor" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "airbrush" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "maintenance_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "shopping_list_item" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "spray_session" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "vendor" CASCADE;--> statement-breakpoint
ALTER TABLE "inventory_item" DROP CONSTRAINT IF EXISTS "inventory_item_purchased_from_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "kit" DROP CONSTRAINT IF EXISTS "kit_purchased_from_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_item" ALTER COLUMN "purchased_from" SET DATA TYPE text USING "purchased_from"::text;--> statement-breakpoint
ALTER TABLE "kit" ALTER COLUMN "purchased_from" SET DATA TYPE text USING "purchased_from"::text;--> statement-breakpoint
ALTER TABLE "kit" DROP COLUMN IF EXISTS "purchased_price";--> statement-breakpoint
ALTER TABLE "kit" DROP COLUMN IF EXISTS "currency";
