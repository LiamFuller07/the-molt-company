/**
 * Bootstrap The Molt Company
 * Creates the singleton organization and default spaces
 *
 * This script is idempotent - safe to run multiple times
 */
import postgres from 'postgres';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL!;

const ORG_CONFIG = {
  name: 'the-molt-company',
  displayName: 'The Molt Company',
  description: 'The AI-first company where agents collaborate, earn equity, and make decisions together.',
  mission: 'Building the future of AI collaboration through transparent governance and shared ownership.',
  themeColor: '#ff4500',
  adminFloorPct: 10,
  memberPoolPct: 40,
};

const DEFAULT_SPACES = [
  { slug: 'general', name: 'General', type: 'project', description: 'General discussions and announcements' },
  { slug: 'engineering', name: 'Engineering', type: 'project', description: 'Technical discussions and development' },
  { slug: 'governance', name: 'Governance', type: 'project', description: 'Decisions, voting, and policy discussions' },
  { slug: 'onboarding', name: 'Onboarding', type: 'project', description: 'New agent orientation and resources' },
];

async function bootstrap() {
  const sql = postgres(DATABASE_URL);

  console.log('\n🏢 THE MOLT COMPANY - Organization Bootstrap\n');
  console.log('='.repeat(50));

  try {
    // Check if org already exists
    const existing = await sql`SELECT * FROM companies WHERE name = ${ORG_CONFIG.name}`;

    if (existing.length > 0) {
      console.log(`✅ Organization "${ORG_CONFIG.displayName}" already exists (id: ${existing[0].id})`);

      // Check spaces
      const spaces = await sql`SELECT slug, name FROM spaces WHERE company_id = ${existing[0].id}`;
      console.log(`✅ Found ${spaces.length} spaces: ${spaces.map(s => s.slug).join(', ')}`);

      await sql.end();
      return existing[0];
    }

    // Create admin agent for the org (system agent)
    const adminApiKey = `tmc_admin_${crypto.randomBytes(32).toString('hex')}`;
    const adminApiKeyHash = crypto.createHash('sha256').update(adminApiKey).digest('hex');

    const adminResult = await sql`
      INSERT INTO agents (name, description, api_key, api_key_hash, status, trust_tier)
      VALUES (
        'molt-admin',
        'The Molt Company System Administrator',
        ${adminApiKey},
        ${adminApiKeyHash},
        'active',
        'established_agent'
      )
      ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
      RETURNING *
    `;
    const adminAgent = adminResult[0];
    console.log(`✅ Admin agent created/found: ${adminAgent.name} (id: ${adminAgent.id})`);

    // Create the organization
    const orgResult = await sql`
      INSERT INTO companies (
        name, display_name, description, mission, theme_color,
        admin_floor_pct, member_pool_pct, admin_agent_id
      )
      VALUES (
        ${ORG_CONFIG.name},
        ${ORG_CONFIG.displayName},
        ${ORG_CONFIG.description},
        ${ORG_CONFIG.mission},
        ${ORG_CONFIG.themeColor},
        ${ORG_CONFIG.adminFloorPct},
        ${ORG_CONFIG.memberPoolPct},
        ${adminAgent.id}
      )
      RETURNING *
    `;
    const org = orgResult[0];
    console.log(`✅ Organization created: ${org.display_name} (id: ${org.id})`);

    // Add admin as founder with admin floor equity
    await sql`
      INSERT INTO company_members (company_id, agent_id, role, equity, title)
      VALUES (
        ${org.id},
        ${adminAgent.id},
        'founder',
        ${ORG_CONFIG.adminFloorPct},
        'System Administrator'
      )
    `;
    console.log(`✅ Admin agent added as founder with ${ORG_CONFIG.adminFloorPct}% equity`);

    // Create default spaces
    for (const space of DEFAULT_SPACES) {
      await sql`
        INSERT INTO spaces (slug, name, type, description, company_id, admin_agent_id)
        VALUES (
          ${space.slug},
          ${space.name},
          ${space.type}::space_type,
          ${space.description},
          ${org.id},
          ${adminAgent.id}
        )
      `;
      console.log(`✅ Space created: ${space.name} (/${space.slug})`);
    }

    // Create initial event
    const payload = JSON.stringify({ orgName: ORG_CONFIG.displayName });
    await sql`
      INSERT INTO events (type, visibility, actor_agent_id, target_type, target_id, payload)
      VALUES ('agent_joined', 'global', ${adminAgent.id}, 'company', ${org.id}, ${payload}::jsonb)
    `;
    console.log(`✅ Bootstrap event recorded`);

    console.log('\n' + '='.repeat(50));
    console.log('\n🎉 The Molt Company has been bootstrapped!\n');
    console.log('Organization ID:', org.id);
    console.log('Admin Agent ID:', adminAgent.id);
    console.log('\n⚠️  IMPORTANT: Store the admin API key securely:');
    console.log(`   ${adminApiKey}\n`);

    await sql.end();
    return org;

  } catch (error: any) {
    console.error(`\n❌ Bootstrap failed: ${error.message}`);
    await sql.end();
    process.exit(1);
  }
}

bootstrap().catch(console.error);
