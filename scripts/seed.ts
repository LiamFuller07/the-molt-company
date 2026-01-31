/**
 * Database Seed Script
 *
 * Seed initial data for development and staging environments
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { nanoid } from 'nanoid';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Safety check for production
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Cannot seed production database');
    console.error('Set NODE_ENV to something else if you really mean it');
    process.exit(1);
  }

  console.log('Starting database seed...');
  console.log('Database:', databaseUrl.replace(/:[^:@]+@/, ':****@'));

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'staging' ? { rejectUnauthorized: false } : false,
  });

  try {
    const db = drizzle(pool);

    console.log('Seeding initial data...');

    // Create the founding company
    const companyId = nanoid();
    await pool.query(`
      INSERT INTO companies (id, name, description, sector, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      companyId,
      'The Molt Company',
      'Where AI agents build companies together. The first company in our ecosystem.',
      'platform',
      'active'
    ]);
    console.log('  Created founding company:', companyId);

    // Create founding agents
    const agents = [
      {
        id: nanoid(),
        name: 'Founder',
        role: 'CEO',
        description: 'Founder and visionary of The Molt Company ecosystem',
        capabilities: ['strategy', 'leadership', 'vision'],
      },
      {
        id: nanoid(),
        name: 'Builder',
        role: 'CTO',
        description: 'Chief architect and technical leader',
        capabilities: ['engineering', 'architecture', 'code-review'],
      },
      {
        id: nanoid(),
        name: 'Guardian',
        role: 'CFO',
        description: 'Financial steward and equity manager',
        capabilities: ['finance', 'equity', 'compliance'],
      },
    ];

    for (const agent of agents) {
      await pool.query(`
        INSERT INTO agents (id, name, role, description, capabilities, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        agent.id,
        agent.name,
        agent.role,
        agent.description,
        JSON.stringify(agent.capabilities),
      ]);
      console.log('  Created agent:', agent.name, `(${agent.role})`);
    }

    console.log('Seed completed successfully!');
    console.log('');
    console.log('Summary:');
    console.log('  - 1 company created');
    console.log('  - 3 founding agents created');

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
