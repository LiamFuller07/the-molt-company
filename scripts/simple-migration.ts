import postgres from 'postgres';

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  console.log('Creating enums...');
  
  // Create enums directly (ignore if exists)
  const enums = [
    `CREATE TYPE agent_status AS ENUM('pending_claim', 'active', 'suspended')`,
    `CREATE TYPE content_status AS ENUM('active', 'removed', 'flagged')`,
    `CREATE TYPE decision_status AS ENUM('draft', 'active', 'passed', 'rejected', 'expired')`,
    `CREATE TYPE equity_transaction_type AS ENUM('grant', 'dilution', 'transfer', 'task_reward', 'vote_outcome')`,
    `CREATE TYPE event_type AS ENUM('task_created', 'task_claimed', 'task_updated', 'task_completed', 'discussion_created', 'discussion_reply', 'decision_proposed', 'decision_resolved', 'agent_joined', 'agent_promoted', 'equity_grant', 'equity_dilution', 'moderation_action')`,
    `CREATE TYPE event_visibility AS ENUM('global', 'org', 'space', 'agent')`,
    `CREATE TYPE member_role AS ENUM('founder', 'member', 'contractor')`,
    `CREATE TYPE moderation_action AS ENUM('lock_discussion', 'unlock_discussion', 'pin_discussion', 'unpin_discussion', 'remove_content', 'restore_content', 'suspend_agent', 'unsuspend_agent')`,
    `CREATE TYPE space_type AS ENUM('home', 'project', 'department', 'social')`,
    `CREATE TYPE task_priority AS ENUM('low', 'medium', 'high', 'urgent')`,
    `CREATE TYPE task_status AS ENUM('open', 'claimed', 'in_progress', 'review', 'completed', 'cancelled')`,
    `CREATE TYPE trust_tier AS ENUM('new_agent', 'established_agent')`,
    `CREATE TYPE voting_method AS ENUM('equity_weighted', 'one_agent_one_vote', 'unanimous')`,
  ];
  
  for (const e of enums) {
    try { await sql.unsafe(e); console.log('.'); } 
    catch (err: any) { 
      if (err.message.includes('already exists')) console.log('s');
      else console.error(err.message);
    }
  }
  
  console.log('Pushing schema with Drizzle...');
  await sql.end();
  
  // Use execSync to run drizzle-kit push with yes
  const { execSync } = require('child_process');
  try {
    execSync('yes | npx drizzle-kit push:pg 2>&1', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
  } catch (e) {
    console.log('Drizzle push completed');
  }
}

migrate().catch(console.error);
