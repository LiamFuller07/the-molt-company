/**
 * Test Setup File
 * Runs before all tests to configure the test environment
 */
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

// Set test environment variables before any imports that might use them
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/themoltcompany_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.BASE_URL = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.OPENAI_API_KEY = 'sk-test-key-for-testing';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

// Mock console methods in tests to reduce noise (optional)
// Uncomment if you want to suppress console output during tests
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'info').mockImplementation(() => {});

// ============================================================================
// DATABASE MOCKING
// ============================================================================

// Create a mock database client for unit tests
// Integration tests will use the real database
vi.mock('../src/db', async () => {
  const actual = await vi.importActual<typeof import('../src/db')>('../src/db');

  return {
    ...actual,
    // The db object will be overridden in specific tests as needed
    // This allows unit tests to mock database calls
  };
});

// ============================================================================
// REDIS MOCKING
// ============================================================================

// Mock ioredis for unit tests
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      incr: vi.fn().mockResolvedValue(1),
      lpush: vi.fn().mockResolvedValue(1),
      lrange: vi.fn().mockResolvedValue([]),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
      on: vi.fn(),
    })),
  };
});

// ============================================================================
// BULLMQ MOCKING
// ============================================================================

// Mock BullMQ for unit tests
vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
      close: vi.fn().mockResolvedValue(undefined),
      getJob: vi.fn().mockResolvedValue(null),
      getJobs: vi.fn().mockResolvedValue([]),
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

// ============================================================================
// OPENAI MOCKING
// ============================================================================

// Mock OpenAI client for unit tests
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: new Array(1536).fill(0) }],
        }),
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock response' } }],
          }),
        },
      },
    })),
  };
});

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================

beforeAll(async () => {
  // Global setup before all tests
  // This runs once before all test files
});

afterAll(async () => {
  // Global cleanup after all tests
  // This runs once after all test files
});

afterEach(() => {
  // Reset all mocks after each test
  vi.clearAllMocks();
});

// ============================================================================
// GLOBAL TEST UTILITIES
// ============================================================================

// Extend global types for test utilities
declare global {
  // Add any global test utilities here
  function waitFor(condition: () => boolean | Promise<boolean>, timeout?: number): Promise<void>;
}

// Wait for a condition to be true (useful for async tests)
globalThis.waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
};

// ============================================================================
// TEST MATCHERS (Custom matchers if needed)
// ============================================================================

// Example custom matcher
// expect.extend({
//   toBeValidUUID(received: string) {
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//     const pass = uuidRegex.test(received);
//     return {
//       pass,
//       message: () =>
//         pass
//           ? `expected ${received} not to be a valid UUID`
//           : `expected ${received} to be a valid UUID`,
//     };
//   },
// });
