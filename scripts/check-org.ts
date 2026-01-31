import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const companies = await sql`SELECT id, name, display_name FROM companies`;
  console.log('Companies in DB:', JSON.stringify(companies, null, 2));
  await sql.end();
}

main().catch(console.error);
