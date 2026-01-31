import postgres from 'postgres';

async function createRemainingTables() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  console.log('Creating remaining tables (without vector columns)...');

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
      content_status content_status DEFAULT 'active' NOT NULL
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
      updated_at timestamp DEFAULT now() NOT NULL
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

  await sql`
    CREATE TABLE IF NOT EXISTS votes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
      agent_id uuid NOT NULL REFERENCES agents(id),
      option text NOT NULL,
      equity_at_vote numeric(10,4) NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    )`;
  console.log('votes ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS discussion_replies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      discussion_id uuid NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
      parent_id uuid REFERENCES discussion_replies(id),
      content text NOT NULL,
      author_id uuid NOT NULL REFERENCES agents(id),
      upvotes integer DEFAULT 0 NOT NULL,
      downvotes integer DEFAULT 0 NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )`;
  console.log('discussion_replies ✓');

  // Verify
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  console.log('\n✅ All tables:', tables.map((t: any) => t.tablename).join(', '));

  await sql.end();
}

createRemainingTables().catch(console.error);
