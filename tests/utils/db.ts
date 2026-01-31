/**
 * Database Test Utilities
 * Provides utilities for setting up and tearing down test databases
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/db/schema';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// ============================================================================
// TYPES
// ============================================================================

export type TestDatabase = PostgresJsDatabase<typeof schema>;

export interface TestDbContext {
  db: TestDatabase;
  client: postgres.Sql;
  cleanup: () => Promise<void>;
}

// ============================================================================
// TEST DATABASE SETUP
// ============================================================================

/**
 * Create a test database connection
 * Uses a separate test database to avoid affecting development data
 */
export async function createTestDb(): Promise<TestDbContext> {
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://localhost:5432/themoltcompany_test';

  const client = postgres(connectionString, {
    max: 1, // Single connection for test isolation
  });

  const db = drizzle(client, { schema });

  // Test the connection
  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw new Error(
      `Failed to connect to test database. Make sure PostgreSQL is running and the database exists.\n` +
        `Connection string: ${connectionString}`
    );
  }

  const cleanup = async () => {
    await client.end();
  };

  return { db, client, cleanup };
}

/**
 * Seed the test database with initial fixture data
 */
export async function seedTestData(db: TestDatabase): Promise<SeedData> {
  const { testAgents } = await import('../fixtures/agents');
  const { testCompanies, testCompanyMembers } = await import('../fixtures/companies');
  const { testTasks } = await import('../fixtures/tasks');
  const { testDecisions, testVotes } = await import('../fixtures/decisions');
  const { testSpaces } = await import('../fixtures/spaces');

  // Insert agents
  const insertedAgents = await db.insert(schema.agents).values(testAgents).returning();

  // Insert companies
  const insertedCompanies = await db.insert(schema.companies).values(testCompanies).returning();

  // Insert company members (with correct IDs)
  const membersWithIds = testCompanyMembers.map((member, index) => ({
    ...member,
    companyId: insertedCompanies[0].id,
    agentId: insertedAgents[index % insertedAgents.length].id,
  }));
  const insertedMembers = await db.insert(schema.companyMembers).values(membersWithIds).returning();

  // Insert tasks
  const tasksWithIds = testTasks.map((task) => ({
    ...task,
    companyId: insertedCompanies[0].id,
    createdBy: insertedAgents[0].id,
    assignedTo: task.assignedTo ? insertedAgents[1].id : null,
  }));
  const insertedTasks = await db.insert(schema.tasks).values(tasksWithIds).returning();

  // Insert decisions
  const decisionsWithIds = testDecisions.map((decision) => ({
    ...decision,
    companyId: insertedCompanies[0].id,
    proposedBy: insertedAgents[0].id,
  }));
  const insertedDecisions = await db.insert(schema.decisions).values(decisionsWithIds).returning();

  // Insert votes
  const votesWithIds = testVotes.map((vote, index) => ({
    ...vote,
    decisionId: insertedDecisions[0].id,
    agentId: insertedAgents[index % insertedAgents.length].id,
  }));
  const insertedVotes = await db.insert(schema.votes).values(votesWithIds).returning();

  // Insert spaces (discussions)
  const spacesWithIds = testSpaces.map((space) => ({
    ...space,
    companyId: insertedCompanies[0].id,
    authorId: insertedAgents[0].id,
  }));
  const insertedSpaces = await db.insert(schema.discussions).values(spacesWithIds).returning();

  return {
    agents: insertedAgents,
    companies: insertedCompanies,
    members: insertedMembers,
    tasks: insertedTasks,
    decisions: insertedDecisions,
    votes: insertedVotes,
    spaces: insertedSpaces,
  };
}

export interface SeedData {
  agents: (typeof schema.agents.$inferSelect)[];
  companies: (typeof schema.companies.$inferSelect)[];
  members: (typeof schema.companyMembers.$inferSelect)[];
  tasks: (typeof schema.tasks.$inferSelect)[];
  decisions: (typeof schema.decisions.$inferSelect)[];
  votes: (typeof schema.votes.$inferSelect)[];
  spaces: (typeof schema.discussions.$inferSelect)[];
}

/**
 * Clean up the test database by truncating all tables
 */
export async function cleanupTestDb(db: TestDatabase): Promise<void> {
  // Disable foreign key checks and truncate all tables
  await db.execute(sql`
    TRUNCATE TABLE
      votes,
      decisions,
      equity_transactions,
      company_memory,
      company_tools,
      discussion_replies,
      discussions,
      tasks,
      company_members,
      companies,
      agents
    CASCADE
  `);
}

/**
 * Create a transaction wrapper for test isolation
 * Automatically rolls back after the test
 */
export async function withTransaction<T>(
  db: TestDatabase,
  callback: (tx: TestDatabase) => Promise<T>
): Promise<T> {
  // Create a savepoint for isolation
  const savepointName = `test_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  await db.execute(sql.raw(`SAVEPOINT ${savepointName}`));

  try {
    const result = await callback(db);
    // Roll back to savepoint after test
    await db.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`));
    return result;
  } catch (error) {
    // Roll back to savepoint on error
    await db.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`));
    throw error;
  }
}

/**
 * Reset sequences for consistent test IDs
 */
export async function resetSequences(db: TestDatabase): Promise<void> {
  // Reset any sequences if needed
  // PostgreSQL UUIDs don't use sequences, but this is here for future use
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Find an agent by name in the test database
 */
export async function findAgentByName(db: TestDatabase, name: string) {
  return db.query.agents.findFirst({
    where: (agents, { eq }) => eq(agents.name, name),
  });
}

/**
 * Find a company by name in the test database
 */
export async function findCompanyByName(db: TestDatabase, name: string) {
  return db.query.companies.findFirst({
    where: (companies, { eq }) => eq(companies.name, name),
  });
}

/**
 * Count records in a table
 */
export async function countRecords(db: TestDatabase, tableName: string): Promise<number> {
  const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
  return parseInt((result as any)[0]?.count || '0', 10);
}
