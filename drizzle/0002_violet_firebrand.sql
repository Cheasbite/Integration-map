CREATE TYPE "public"."teleporter_type" AS ENUM('staircase', 'elevator', 'others');--> statement-breakpoint
CREATE TABLE "teleporter_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "teleporter_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "teleporter_group_id" uuid;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_teleporter_group_id_teleporter_groups_id_fk" FOREIGN KEY ("teleporter_group_id") REFERENCES "public"."teleporter_groups"("id") ON DELETE set null ON UPDATE no action;