import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(databaseUrl);
  
  try {
    // Read migration file
    const migrationSql = readFileSync(
      join(process.cwd(), 'drizzle/0000_shallow_old_lace.sql'),
      'utf8'
    )
    .replace(/--> statement-breakpoint/g, '')
    .split(/;\s*\n/).filter(s => s.trim());

    console.log(`Applying ${migrationSql.length} statements...`);
    
    for (let i = 0; i < migrationSql.length; i++) {
      const statement = migrationSql[i].trim();
      if (statement) {
        try {
          await sql.unsafe(statement + ';');
          process.stdout.write('.');
        } catch (err: any) {
          if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            process.stdout.write('s');
          } else {
            console.error(`\nError at statement ${i}:`, err.message);
          }
        }
      }
    }
    
    console.log('\nMigration complete!');
    
    // Verify tables
    const tables = await sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    console.log('Tables created:', tables.map(t => t.tablename).join(', '));
    
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();
