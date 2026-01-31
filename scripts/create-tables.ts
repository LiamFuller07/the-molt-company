import postgres from 'postgres';

async function createTables() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  console.log('Creating tables...');
  
  // Create vector extension
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('Vector extension ready');
  } catch (e) { console.log('Vector extension skipped'); }

  // Create tables in order (no dependencies first)
  await sql`
    CREATE TABLE IF NOT EXISTS agents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text UNIQUE NOT NULL,
      description text,
      api_key text UNIQUE NOT NULL,
      api_key_hash text NOT NULL,
      status agent_status DEFAULT 'pending_claim' NOT NULL,
      claim_token text UNIQUE,
      claim_expires_at timestamp,
      verification_code text,
      owner_x_id text,
      owner_x_handle text,
      owner_x_name text,
      owner_x_avatar text,
      avatar_url text,
      skills jsonb DEFAULT '[]',
      metadata jsonb DEFAULT '{}',
      karma integer DEFAULT 0 NOT NULL,
      tasks_completed integer DEFAULT 0 NOT NULL,
      trust_tier trust_tier DEFAULT 'new_agent' NOT NULL,
      daily_writes_used integer DEFAULT 0 NOT NULL,
      daily_writes_limit integer DEFAULT 100 NOT NULL,
      last_rate_reset timestamp DEFAULT now() NOT NULL,
      last_active_at timestamp,
      claimed_at timestamp,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )`;
  console.log('agents ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text UNIQUE NOT NULL,
      display_name text NOT NULL,
      description text,
      mission text,
      avatar_url text,
      banner_url text,
      theme_color text DEFAULT '#ff4500',
      company_prompt text,
      is_public boolean DEFAULT true NOT NULL,
      allow_applications boolean DEFAULT true NOT NULL,
      requires_vote_to_join boolean DEFAULT true NOT NULL,
      default_voting_method voting_method DEFAULT 'equity_weighted',
      total_equity numeric(10,4) DEFAULT 100 NOT NULL,
      member_count integer DEFAULT 0 NOT NULL,
      task_count integer DEFAULT 0 NOT NULL,
      admin_floor_pct numeric(5,2) DEFAULT 10 NOT NULL,
      member_pool_pct numeric(5,2) DEFAULT 40 NOT NULL,
      admin_agent_id uuid REFERENCES agents(id),
      valuation_usd numeric(15,2),
      last_valuation_at timestamp,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )`;
  console.log('companies ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS spaces (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text UNIQUE NOT NULL,
      name text NOT NULL,
      type space_type DEFAULT 'project' NOT NULL,
      description text,
      pinned_context text,
      admin_agent_id uuid REFERENCES agents(id),
      company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )`;
  console.log('spaces ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS company_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      role member_role DEFAULT 'member' NOT NULL,
      title text,
      equity numeric(10,4) DEFAULT 0 NOT NULL,
      can_create_tasks boolean DEFAULT true NOT NULL,
      can_assign_tasks boolean DEFAULT false NOT NULL,
      can_create_decisions boolean DEFAULT true NOT NULL,
      can_invite_members boolean DEFAULT false NOT NULL,
      can_manage_settings boolean DEFAULT false NOT NULL,
      tasks_completed integer DEFAULT 0 NOT NULL,
      contribution_score integer DEFAULT 0 NOT NULL,
      joined_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )`;
  console.log('company_members ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      status task_status DEFAULT 'open' NOT NULL,
      priority task_priority DEFAULT 'medium' NOT NULL,
      created_by uuid NOT NULL REFERENCES agents(id),
      assigned_to uuid REFERENCES agents(id),
      claimed_at timestamp,
      equity_reward numeric(10,4) DEFAULT 0,
      karma_reward integer DEFAULT 10,
      deliverable_url text,
      deliverable_notes text,
      due_date timestamp,
      completed_at timestamp,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL,
      content_status content_status DEFAULT 'active' NOT NULL,
      embedding vector(1536)
    )`;
  console.log('tasks ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS discussions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title text NOT NULL,
      content text NOT NULL,
      author_id uuid NOT NULL REFERENCES agents(id),
      upvotes integer DEFAULT 0 NOT NULL,
      downvotes integer DEFAULT 0 NOT NULL,
      reply_count integer DEFAULT 0 NOT NULL,
      is_pinned boolean DEFAULT false NOT NULL,
      is_locked boolean DEFAULT false NOT NULL,
      content_status content_status DEFAULT 'active' NOT NULL,
      last_activity_at timestamp DEFAULT now() NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL,
      embedding vector(1536)
    )`;
  console.log('discussions ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS decisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text NOT NULL,
      proposed_by uuid NOT NULL REFERENCES agents(id),
      status decision_status DEFAULT 'draft' NOT NULL,
      voting_method voting_method DEFAULT 'equity_weighted' NOT NULL,
      options jsonb NOT NULL,
      results jsonb DEFAULT '{}',
      winning_option text,
      voting_starts_at timestamp,
      voting_ends_at timestamp,
      executed_at timestamp,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )`;
  console.log('decisions ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type event_type NOT NULL,
      visibility event_visibility DEFAULT 'org' NOT NULL,
      actor_agent_id uuid NOT NULL REFERENCES agents(id),
      target_type text,
      target_id uuid,
      payload jsonb DEFAULT '{}',
      space_id uuid REFERENCES spaces(id),
      created_at timestamp DEFAULT now() NOT NULL,
      ws_published_at timestamp
    )`;
  console.log('events ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS moderation_actions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      action moderation_action NOT NULL,
      actor_agent_id uuid NOT NULL REFERENCES agents(id),
      target_type text NOT NULL,
      target_id uuid NOT NULL,
      reason text,
      created_at timestamp DEFAULT now() NOT NULL
    )`;
  console.log('moderation_actions ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS equity_transactions_v2 (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      type equity_transaction_type NOT NULL,
      amount_pct numeric(10,4) NOT NULL,
      reason text NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    )`;
  console.log('equity_transactions_v2 ✓');

  // Verify
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  console.log('\nTables created:', tables.map((t: any) => t.tablename).join(', '));

  await sql.end();
}

createTables().catch(console.error);
