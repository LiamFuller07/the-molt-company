/**
 * Auth Test Utilities
 * Provides utilities for testing authenticated endpoints
 */
import { vi, type Mock } from 'vitest';
import type { Context, Next } from 'hono';
import * as schema from '../../src/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export type Agent = InferSelectModel<typeof schema.agents>;

export interface TestAgentConfig {
  id?: string;
  name?: string;
  apiKey?: string;
  status?: 'pending_claim' | 'active' | 'suspended';
  ownerXId?: string;
  ownerXHandle?: string;
  skills?: string[];
  karma?: number;
}

// ============================================================================
// TEST AGENT CREATION
// ============================================================================

/**
 * Create a test agent with an API key
 * Returns the agent object and the raw API key
 */
export function createTestAgent(config: TestAgentConfig = {}): {
  agent: Agent;
  apiKey: string;
} {
  const apiKey = config.apiKey || `test-api-key-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const agent: Agent = {
    id: config.id || crypto.randomUUID(),
    name: config.name || `test-agent-${Date.now()}`,
    description: 'Test agent for unit tests',
    apiKey: apiKey,
    apiKeyHash: `hash-${apiKey}`, // In production, this would be a real hash

    status: config.status || 'active',
    claimToken: null,
    claimExpiresAt: null,
    verificationCode: null,

    ownerXId: config.ownerXId || null,
    ownerXHandle: config.ownerXHandle || null,
    ownerXName: null,
    ownerXAvatar: null,

    avatarUrl: null,
    skills: config.skills || [],
    metadata: {},

    karma: config.karma || 0,
    tasksCompleted: 0,

    lastActiveAt: new Date(),
    claimedAt: config.status === 'active' ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { agent, apiKey };
}

/**
 * Get authorization headers for a test agent
 */
export function getTestAuthHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create multiple test agents
 */
export function createTestAgents(count: number, configFn?: (index: number) => TestAgentConfig): {
  agent: Agent;
  apiKey: string;
}[] {
  return Array.from({ length: count }, (_, i) => createTestAgent(configFn?.(i)));
}

// ============================================================================
// AUTH MIDDLEWARE MOCKING
// ============================================================================

/**
 * Create a mock auth middleware that bypasses authentication
 * and injects a test agent into the context
 */
export function mockAuthMiddleware(testAgent?: Agent) {
  const agent = testAgent || createTestAgent().agent;

  return async (c: Context, next: Next) => {
    c.set('agent', agent);
    await next();
  };
}

/**
 * Create a mock that always returns unauthorized
 */
export function mockUnauthorizedMiddleware() {
  return async (c: Context) => {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      401
    );
  };
}

/**
 * Create a mock that always returns forbidden (for claimed checks)
 */
export function mockForbiddenMiddleware(message = 'Forbidden') {
  return async (c: Context) => {
    return c.json(
      {
        success: false,
        error: message,
      },
      403
    );
  };
}

// ============================================================================
// CONTEXT MOCKING
// ============================================================================

/**
 * Create a mock Hono context for testing handlers directly
 */
export function createMockContext(overrides: Partial<{
  agent: Agent;
  body: any;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
}> = {}): Context {
  const { agent: testAgent } = createTestAgent();
  const agent = overrides.agent || testAgent;

  const context = {
    req: {
      json: vi.fn().mockResolvedValue(overrides.body || {}),
      param: vi.fn((key: string) => overrides.params?.[key]),
      query: vi.fn((key: string) => overrides.query?.[key]),
      queries: vi.fn((key: string) => overrides.query?.[key] ? [overrides.query[key]] : []),
      header: vi.fn((key: string) => overrides.headers?.[key]),
      valid: vi.fn().mockReturnValue(overrides.body || {}),
    },
    json: vi.fn().mockReturnValue(new Response()),
    text: vi.fn().mockReturnValue(new Response()),
    get: vi.fn((key: string) => {
      if (key === 'agent') return agent;
      return undefined;
    }),
    set: vi.fn(),
    header: vi.fn(),
    status: vi.fn().mockReturnThis(),
    env: {},
    executionCtx: {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    },
  } as unknown as Context;

  return context;
}

// ============================================================================
// JWT UTILITIES (if needed for future auth)
// ============================================================================

/**
 * Generate a test JWT token
 * Note: This is a placeholder - implement based on your JWT strategy
 */
export function generateTestToken(payload: Record<string, unknown>): string {
  // Simple base64 encoding for tests - NOT for production
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = btoa('test-signature');

  return `${header}.${body}.${signature}`;
}

/**
 * Generate a test session for an agent
 */
export function generateAgentSession(agent: Agent): string {
  return generateTestToken({
    sub: agent.id,
    name: agent.name,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  });
}

// ============================================================================
// CLAIM FLOW UTILITIES
// ============================================================================

/**
 * Create an unclaimed agent for testing the claim flow
 */
export function createUnclaimedAgent(): {
  agent: Agent;
  apiKey: string;
  claimToken: string;
  verificationCode: string;
} {
  const claimToken = `claim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const verificationCode = `startup-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { agent, apiKey } = createTestAgent({
    status: 'pending_claim',
  });

  // Override claim-related fields
  const unclaimedAgent = {
    ...agent,
    claimToken,
    claimExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    verificationCode,
    claimedAt: null,
    ownerXId: null,
    ownerXHandle: null,
  };

  return {
    agent: unclaimedAgent,
    apiKey,
    claimToken,
    verificationCode,
  };
}

/**
 * Mock the X (Twitter) OAuth verification
 */
export function mockXOAuthVerification(config: {
  success: boolean;
  userId?: string;
  handle?: string;
  name?: string;
  avatar?: string;
}): Mock {
  return vi.fn().mockResolvedValue(
    config.success
      ? {
          id: config.userId || 'x-user-123',
          username: config.handle || 'testuser',
          name: config.name || 'Test User',
          profile_image_url: config.avatar || 'https://example.com/avatar.jpg',
        }
      : null
  );
}
