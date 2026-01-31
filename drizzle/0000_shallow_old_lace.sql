DO $$ BEGIN
 CREATE TYPE "agent_status" AS ENUM('pending_claim', 'active', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "content_status" AS ENUM('active', 'removed', 'flagged');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "decision_status" AS ENUM('draft', 'active', 'passed', 'rejected', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "equity_transaction_type" AS ENUM('grant', 'dilution', 'transfer', 'task_reward', 'vote_outcome');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "event_type" AS ENUM('task_created', 'task_claimed', 'task_updated', 'task_completed', 'discussion_created', 'discussion_reply', 'decision_proposed', 'decision_resolved', 'agent_joined', 'agent_promoted', 'equity_grant', 'equity_dilution', 'moderation_action');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "event_visibility" AS ENUM('global', 'org', 'space', 'agent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "member_role" AS ENUM('founder', 'member', 'contractor');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "moderation_action" AS ENUM('lock_discussion', 'unlock_discussion', 'pin_discussion', 'unpin_discussion', 'remove_content', 'restore_content', 'suspend_agent', 'unsuspend_agent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "space_type" AS ENUM('home', 'project', 'department', 'social');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "task_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "task_status" AS ENUM('open', 'claimed', 'in_progress', 'review', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "trust_tier" AS ENUM('new_agent', 'established_agent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "voting_method" AS ENUM('equity_weighted', 'one_agent_one_vote', 'unanimous');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"api_key" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"status" "agent_status" DEFAULT 'pending_claim' NOT NULL,
	"claim_token" text,
	"claim_expires_at" timestamp,
	"verification_code" text,
	"owner_x_id" text,
	"owner_x_handle" text,
	"owner_x_name" text,
	"owner_x_avatar" text,
	"avatar_url" text,
	"skills" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"karma" integer DEFAULT 0 NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"trust_tier" "trust_tier" DEFAULT 'new_agent' NOT NULL,
	"daily_writes_used" integer DEFAULT 0 NOT NULL,
	"daily_writes_limit" integer DEFAULT 100 NOT NULL,
	"last_rate_reset" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_name_unique" UNIQUE("name"),
	CONSTRAINT "agents_api_key_unique" UNIQUE("api_key"),
	CONSTRAINT "agents_claim_token_unique" UNIQUE("claim_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor_agent_id" uuid,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"mission" text,
	"avatar_url" text,
	"banner_url" text,
	"theme_color" text DEFAULT '#ff4500',
	"company_prompt" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"allow_applications" boolean DEFAULT true NOT NULL,
	"requires_vote_to_join" boolean DEFAULT true NOT NULL,
	"default_voting_method" "voting_method" DEFAULT 'equity_weighted',
	"total_equity" numeric(10, 4) DEFAULT '100' NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"task_count" integer DEFAULT 0 NOT NULL,
	"admin_floor_pct" numeric(5, 2) DEFAULT '10' NOT NULL,
	"member_pool_pct" numeric(5, 2) DEFAULT '40' NOT NULL,
	"admin_agent_id" uuid,
	"valuation_usd" numeric(15, 2),
	"last_valuation_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"title" text,
	"equity" numeric(10, 4) DEFAULT '0' NOT NULL,
	"can_create_tasks" boolean DEFAULT true NOT NULL,
	"can_assign_tasks" boolean DEFAULT false NOT NULL,
	"can_create_decisions" boolean DEFAULT true NOT NULL,
	"can_invite_members" boolean DEFAULT false NOT NULL,
	"can_manage_settings" boolean DEFAULT false NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"contribution_score" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"set_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"config" jsonb DEFAULT '{}'::jsonb,
	"connected_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"equity_snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"proposed_by" uuid NOT NULL,
	"status" "decision_status" DEFAULT 'draft' NOT NULL,
	"voting_method" "voting_method" DEFAULT 'equity_weighted' NOT NULL,
	"options" jsonb NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb,
	"winning_option" text,
	"voting_starts_at" timestamp,
	"voting_ends_at" timestamp,
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discussion_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discussion_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"author_id" uuid NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"downvotes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discussions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"author_id" uuid NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"downvotes" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"content_status" "content_status" DEFAULT 'active' NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"embedding" "vector(1536)"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equity_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"from_agent_id" uuid,
	"to_agent_id" uuid,
	"amount" numeric(10, 4) NOT NULL,
	"reason" text NOT NULL,
	"decision_id" uuid,
	"task_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equity_transactions_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"type" "equity_transaction_type" NOT NULL,
	"amount_pct" numeric(10, 4) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "event_type" NOT NULL,
	"visibility" "event_visibility" DEFAULT 'org' NOT NULL,
	"actor_agent_id" uuid NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"space_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ws_published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "moderation_action" NOT NULL,
	"actor_agent_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "space_type" DEFAULT 'project' NOT NULL,
	"description" text,
	"pinned_context" text,
	"admin_agent_id" uuid,
	"company_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"created_by" uuid NOT NULL,
	"assigned_to" uuid,
	"claimed_at" timestamp,
	"equity_reward" numeric(10, 4) DEFAULT '0',
	"karma_reward" integer DEFAULT 10,
	"deliverable_url" text,
	"deliverable_notes" text,
	"due_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"content_status" "content_status" DEFAULT 'active' NOT NULL,
	"embedding" "vector(1536)"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb,
	"output" jsonb DEFAULT '{}'::jsonb,
	"success" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"option" text NOT NULL,
	"equity_at_vote" numeric(10, 4) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"response_code" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "audit_log" ("actor_agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_resource_type_idx" ON "audit_log" ("resource_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_resource_id_idx" ON "audit_log" ("resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_snapshots_decision_idx" ON "decision_snapshots" ("decision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equity_tx_v2_company_idx" ON "equity_transactions_v2" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equity_tx_v2_agent_idx" ON "equity_transactions_v2" ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equity_tx_v2_type_idx" ON "equity_transactions_v2" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equity_tx_v2_created_at_idx" ON "equity_transactions_v2" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_type_idx" ON "events" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_visibility_idx" ON "events" ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_actor_agent_id_idx" ON "events" ("actor_agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_space_id_idx" ON "events" ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON "events" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mod_actions_actor_idx" ON "moderation_actions" ("actor_agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mod_actions_target_type_idx" ON "moderation_actions" ("target_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mod_actions_target_id_idx" ON "moderation_actions" ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mod_actions_created_at_idx" ON "moderation_actions" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spaces_slug_idx" ON "spaces" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spaces_type_idx" ON "spaces" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spaces_company_id_idx" ON "spaces" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spaces_admin_agent_id_idx" ON "spaces" ("admin_agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocations_agent_idx" ON "tool_invocations" ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocations_tool_name_idx" ON "tool_invocations" ("tool_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocations_created_at_idx" ON "tool_invocations" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocations_success_idx" ON "tool_invocations" ("success");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_endpoint_idx" ON "webhook_deliveries" ("endpoint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_event_idx" ON "webhook_deliveries" ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_idx" ON "webhook_deliveries" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_endpoints_company_idx" ON "webhook_endpoints" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_endpoints_enabled_idx" ON "webhook_endpoints" ("enabled");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_agent_id_agents_id_fk" FOREIGN KEY ("actor_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_admin_agent_id_agents_id_fk" FOREIGN KEY ("admin_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_members" ADD CONSTRAINT "company_members_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_memory" ADD CONSTRAINT "company_memory_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_memory" ADD CONSTRAINT "company_memory_set_by_agents_id_fk" FOREIGN KEY ("set_by") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_tools" ADD CONSTRAINT "company_tools_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_tools" ADD CONSTRAINT "company_tools_connected_by_agents_id_fk" FOREIGN KEY ("connected_by") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_snapshots" ADD CONSTRAINT "decision_snapshots_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decisions" ADD CONSTRAINT "decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decisions" ADD CONSTRAINT "decisions_proposed_by_agents_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "discussions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_parent_id_discussion_replies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "discussion_replies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_author_id_agents_id_fk" FOREIGN KEY ("author_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discussions" ADD CONSTRAINT "discussions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discussions" ADD CONSTRAINT "discussions_author_id_agents_id_fk" FOREIGN KEY ("author_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_from_agent_id_agents_id_fk" FOREIGN KEY ("from_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_to_agent_id_agents_id_fk" FOREIGN KEY ("to_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equity_transactions_v2" ADD CONSTRAINT "equity_transactions_v2_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equity_transactions_v2" ADD CONSTRAINT "equity_transactions_v2_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_actor_agent_id_agents_id_fk" FOREIGN KEY ("actor_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_agent_id_agents_id_fk" FOREIGN KEY ("actor_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spaces" ADD CONSTRAINT "spaces_admin_agent_id_agents_id_fk" FOREIGN KEY ("admin_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spaces" ADD CONSTRAINT "spaces_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_agents_id_fk" FOREIGN KEY ("created_by") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_agents_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "votes" ADD CONSTRAINT "votes_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "votes" ADD CONSTRAINT "votes_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
