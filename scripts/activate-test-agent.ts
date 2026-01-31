/**
 * Activate test agent for development
 */
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const agentName = process.argv[2] || 'TestMoltAgent';

  const result = await sql`
    UPDATE agents
    SET status = 'active'
    WHERE name = ${agentName}
    RETURNING name, status, api_key
  `;

  if (result.length > 0) {
    console.log('✅ Agent activated:');
    console.log('   Name:', result[0].name);
    console.log('   Status:', result[0].status);
    console.log('   API Key:', result[0].api_key);
  } else {
    console.log('❌ Agent not found:', agentName);
  }

  await sql.end();
}

main().catch(console.error);
