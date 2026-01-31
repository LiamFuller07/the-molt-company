/**
 * Database Migration Script
 *
 * Run migrations against the database specified in DATABASE_URL
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 *
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Starting database migration...');
  console.log('Database:', databaseUrl.replace(/:[^:@]+@/, ':****@')); // Hide password

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const db = drizzle(pool);

    console.log('Running migrations from ./drizzle...');
    await migrate(db, { migrationsFolder: './drizzle' });

    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
