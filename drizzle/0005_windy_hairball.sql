CREATE TABLE "travel_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"from_body_id" integer,
	"to_body_id" integer NOT NULL,
	"source" text DEFAULT 'telegram' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "visual_radius" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "visual_radius" SET DEFAULT '1';--> statement-breakpoint
UPDATE "celestial_bodies" SET "visual_radius" = 1 WHERE "visual_radius" IS NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "visual_radius" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "orbit" SET DATA TYPE numeric(7, 2);--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "orbit" SET DEFAULT '10';--> statement-breakpoint
UPDATE "celestial_bodies" SET "orbit" = 10 WHERE "orbit" IS NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "orbit" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "orbit_speed" SET DATA TYPE numeric(8, 6);--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "orbit_speed" SET DEFAULT '0.1';--> statement-breakpoint
UPDATE "celestial_bodies" SET "orbit_speed" = 0.1 WHERE "orbit_speed" IS NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "orbit_speed" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "spin_speed" SET DATA TYPE numeric(8, 6);--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "spin_speed" SET DEFAULT '0.1';--> statement-breakpoint
UPDATE "celestial_bodies" SET "spin_speed" = 0.1 WHERE "spin_speed" IS NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "spin_speed" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "tilt" SET DATA TYPE numeric(5, 3);--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "tilt" SET DEFAULT '0';--> statement-breakpoint
UPDATE "celestial_bodies" SET "tilt" = 0 WHERE "tilt" IS NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "tilt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "phase" SET DATA TYPE numeric(5, 3);--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "phase" SET DEFAULT '0';--> statement-breakpoint
UPDATE "celestial_bodies" SET "phase" = 0 WHERE "phase" IS NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "phase" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "color" SET DEFAULT '#ffffff';--> statement-breakpoint
UPDATE "celestial_bodies" SET "color" = '#ffffff' WHERE "color" IS NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "color" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "has_rings" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "has_rings" SET DATA TYPE boolean USING (COALESCE("has_rings"::text = 'true', false));--> statement-breakpoint
UPDATE "celestial_bodies" SET "has_rings" = false WHERE "has_rings" IS NULL;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "has_rings" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ALTER COLUMN "has_rings" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "player_characters" ADD COLUMN "context_summary" text;--> statement-breakpoint
ALTER TABLE "player_characters" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "travel_history" ADD CONSTRAINT "travel_history_from_body_id_celestial_bodies_id_fk" FOREIGN KEY ("from_body_id") REFERENCES "public"."celestial_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_history" ADD CONSTRAINT "travel_history_to_body_id_celestial_bodies_id_fk" FOREIGN KEY ("to_body_id") REFERENCES "public"."celestial_bodies"("id") ON DELETE no action ON UPDATE no action;