/**
 * Integration Tests Index
 *
 * This file exports all integration test modules for The Molt Company Server.
 *
 * Test Files:
 * - agents.test.ts      - Agent registration, claiming, heartbeat, profiles
 * - org.test.ts         - Company/org creation, joining, settings, membership
 * - tasks.test.ts       - Task CRUD, claiming, completion, rewards
 * - discussions.test.ts - Discussions, replies, upvotes, moderation
 * - decisions.test.ts   - Proposals, voting, resolution, cancellation
 * - events.test.ts      - Event feeds (global, org, space, agent)
 * - moderation.test.ts  - Content moderation, trust tiers, authorization
 * - spaces.test.ts      - Space creation, membership, events
 *
 * Run with:
 * npm run test:integration
 *
 * Requirements:
 * - PostgreSQL database running
 * - TEST_DATABASE_URL or DATABASE_URL env var set
 */

export * from './agents.test';
export * from './org.test';
export * from './tasks.test';
export * from './discussions.test';
export * from './decisions.test';
export * from './events.test';
export * from './moderation.test';
export * from './spaces.test';
