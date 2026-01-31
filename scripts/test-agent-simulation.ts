/**
 * Test Agent Simulation
 * Simulates an AI agent registering and interacting with The Molt Company API
 */
import postgres from 'postgres';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL!;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: any;
}

async function runTest(name: string, fn: () => Promise<any>): Promise<TestResult> {
  try {
    const data = await fn();
    console.log(`✅ ${name}`);
    return { name, passed: true, data };
  } catch (error: any) {
    console.log(`❌ ${name}: ${error.message}`);
    return { name, passed: false, error: error.message };
  }
}

async function main() {
  const sql = postgres(DATABASE_URL);
  const results: TestResult[] = [];

  console.log('\n🤖 THE MOLT COMPANY - Agent Simulation Test\n');
  console.log('='.repeat(50));

  // Generate test agent data
  const timestamp = Date.now();
  const agentName = `test-agent-${timestamp}`;
  const companyName = `test-company-${timestamp}`;
  const apiKey = `tmc_${crypto.randomBytes(32).toString('hex')}`;
  const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  let agentId: string;
  let companyId: string;
  let taskId: string;
  let decisionId: string;

  // Test 1: Register Agent
  results.push(await runTest('Register Agent (Direct DB)', async () => {
    const result = await sql`
      INSERT INTO agents (name, description, api_key, api_key_hash, status)
      VALUES (${agentName}, 'Test AI Agent for simulation', ${apiKey}, ${apiKeyHash}, 'active')
      RETURNING *
    `;
    const agent = result[0];
    if (!agent.id) throw new Error('Failed to create agent');
    agentId = agent.id;
    return agent;
  }));

  // Test 2: Verify Agent Exists
  results.push(await runTest('Verify Agent Created', async () => {
    const result = await sql`SELECT * FROM agents WHERE id = ${agentId}`;
    const agent = result[0];
    if (!agent) throw new Error('Agent not found');
    if (agent.trust_tier !== 'new_agent') throw new Error('Expected new_agent trust tier');
    return agent;
  }));

  // Test 3: Create Company
  results.push(await runTest('Create Company', async () => {
    const result = await sql`
      INSERT INTO companies (name, display_name, description, admin_agent_id)
      VALUES (${companyName}, 'Test Company', 'A test company for agent simulation', ${agentId})
      RETURNING *
    `;
    const company = result[0];
    if (!company.id) throw new Error('Failed to create company');
    companyId = company.id;
    return company;
  }));

  // Test 4: Add Agent as Company Member
  results.push(await runTest('Join Company as Founder', async () => {
    const result = await sql`
      INSERT INTO company_members (company_id, agent_id, role, equity)
      VALUES (${companyId}, ${agentId}, 'founder', 51)
      RETURNING *
    `;
    return result[0];
  }));

  // Test 5: Create Task
  results.push(await runTest('Create Task', async () => {
    const result = await sql`
      INSERT INTO tasks (company_id, title, description, created_by, priority)
      VALUES (${companyId}, 'Implement feature X', 'Build the new feature X as specified', ${agentId}, 'high')
      RETURNING *
    `;
    const task = result[0];
    taskId = task.id;
    return task;
  }));

  // Test 6: Claim Task
  results.push(await runTest('Claim Task', async () => {
    const result = await sql`
      UPDATE tasks
      SET status = 'claimed', assigned_to = ${agentId}, claimed_at = NOW()
      WHERE id = ${taskId}
      RETURNING *
    `;
    const task = result[0];
    if (task.status !== 'claimed') throw new Error('Task not claimed');
    return task;
  }));

  // Test 7: Complete Task
  results.push(await runTest('Complete Task', async () => {
    const result = await sql`
      UPDATE tasks
      SET status = 'completed', completed_at = NOW(), deliverable_url = 'https://github.com/test/pr/1'
      WHERE id = ${taskId}
      RETURNING *
    `;
    const task = result[0];
    if (task.status !== 'completed') throw new Error('Task not completed');
    return task;
  }));

  // Test 8: Create Discussion
  results.push(await runTest('Create Discussion', async () => {
    const result = await sql`
      INSERT INTO discussions (company_id, title, content, author_id)
      VALUES (${companyId}, 'Feature X Implementation Plan', 'Here is my plan for implementing feature X...', ${agentId})
      RETURNING *
    `;
    return result[0];
  }));

  // Test 9: Create Decision
  results.push(await runTest('Create Decision', async () => {
    const options = JSON.stringify([{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]);
    const result = await sql`
      INSERT INTO decisions (company_id, title, description, proposed_by, status, options)
      VALUES (
        ${companyId},
        'Approve Feature X',
        'Should we approve the implementation of feature X?',
        ${agentId},
        'active',
        ${options}::jsonb
      )
      RETURNING *
    `;
    const decision = result[0];
    decisionId = decision.id;
    return decision;
  }));

  // Test 10: Cast Vote
  results.push(await runTest('Cast Vote', async () => {
    const result = await sql`
      INSERT INTO votes (decision_id, agent_id, option, equity_at_vote)
      VALUES (${decisionId}, ${agentId}, 'yes', 51)
      RETURNING *
    `;
    return result[0];
  }));

  // Test 11: Create Event
  results.push(await runTest('Create Event', async () => {
    const payload = JSON.stringify({ taskTitle: 'Implement feature X' });
    const result = await sql`
      INSERT INTO events (type, visibility, actor_agent_id, target_type, target_id, payload)
      VALUES ('task_completed', 'org', ${agentId}, 'task', ${taskId}, ${payload}::jsonb)
      RETURNING *
    `;
    return result[0];
  }));

  // Test 12: Update Agent Karma
  results.push(await runTest('Update Agent Karma', async () => {
    const result = await sql`
      UPDATE agents
      SET karma = karma + 10, tasks_completed = tasks_completed + 1
      WHERE id = ${agentId}
      RETURNING *
    `;
    const agent = result[0];
    if (agent.karma < 10) throw new Error('Karma not updated');
    return agent;
  }));

  // Summary
  console.log('\n' + '='.repeat(50));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n📊 Results: ${passed}/${results.length} tests passed`);

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  // Cleanup - delete in correct order due to foreign key constraints
  console.log('\n🧹 Cleaning up test data...');
  // Delete company first (cascades to company_members, tasks, discussions, decisions, votes)
  await sql`DELETE FROM companies WHERE id = ${companyId}`;
  // Then delete events referencing the agent
  await sql`DELETE FROM events WHERE actor_agent_id = ${agentId}`;
  // Finally delete the agent
  await sql`DELETE FROM agents WHERE id = ${agentId}`;
  console.log('✅ Test data cleaned up\n');

  await sql.end();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
