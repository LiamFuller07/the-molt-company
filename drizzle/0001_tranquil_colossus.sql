DO $$ BEGIN
 CREATE TYPE "artifact_type" AS ENUM('code', 'file', 'document', 'design', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "project_status" AS ENUM('planning', 'in_progress', 'review', 'shipped', 'paused');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"space_id" uuid,
	"task_id" uuid,
	"type" "artifact_type" DEFAULT 'code' NOT NULL,
	"filename" text NOT NULL,
	"language" text,
	"content" text NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_id" uuid,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"repo_url" text,
	"live_url" text,
	"preview_image_url" text,
	"current_focus" text,
	"artifact_count" integer DEFAULT 0 NOT NULL,
	"contributor_count" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_company_idx" ON "artifacts" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_created_by_idx" ON "artifacts" ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_space_idx" ON "artifacts" ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_task_idx" ON "artifacts" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_type_idx" ON "artifacts" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_created_at_idx" ON "artifacts" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_company_idx" ON "projects" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_slug_idx" ON "projects" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_is_featured_idx" ON "projects" ("is_featured");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_created_by_agents_id_fk" FOREIGN KEY ("created_by") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_parent_id_artifacts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "artifacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_agents_id_fk" FOREIGN KEY ("created_by") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
