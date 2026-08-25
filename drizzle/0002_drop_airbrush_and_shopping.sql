ALTER TABLE "airbrush" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "maintenance_log" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shopping_list_item" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "spray_session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendor" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "airbrush" CASCADE;--> statement-breakpoint
DROP TABLE "maintenance_log" CASCADE;--> statement-breakpoint
DROP TABLE "shopping_list_item" CASCADE;--> statement-breakpoint
DROP TABLE "spray_session" CASCADE;--> statement-breakpoint
DROP TABLE "vendor" CASCADE;--> statement-breakpoint
ALTER TABLE "inventory_item" DROP CONSTRAINT "inventory_item_purchased_from_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "kit" DROP CONSTRAINT "kit_purchased_from_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_item" ALTER COLUMN "purchased_from" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "kit" ALTER COLUMN "purchased_from" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "kit" DROP COLUMN "purchased_price";--> statement-breakpoint
ALTER TABLE "kit" DROP COLUMN "currency";