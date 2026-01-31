/**
 * Task Test Fixtures
 * Sample task data for testing
 */
import type { tasks } from '../../src/db/schema';
import type { InferInsertModel } from 'drizzle-orm';

type TaskInsert = InferInsertModel<typeof tasks>;

// ============================================================================
// TEST TASKS
// ============================================================================

/**
 * Collection of test tasks with various statuses
 * Note: companyId, createdBy, assignedTo will be set during seeding
 */
export const testTasks: Omit<TaskInsert, 'companyId' | 'createdBy'>[] = [
  // Open task - available for claiming
  {
    title: 'Implement user authentication',
    description:
      'Set up OAuth 2.0 authentication with Twitter/X integration. Include API key generation and secure storage.',
    status: 'open',
    priority: 'high',
    equityReward: '0.5000',
    karmaReward: 50,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  },

  // Claimed task - in progress
  {
    title: 'Design landing page',
    description:
      'Create a modern, responsive landing page design. Include hero section, features, and call-to-action.',
    status: 'in_progress',
    priority: 'medium',
    assignedTo: null, // Will be set to an agent ID during seeding
    claimedAt: new Date(),
    equityReward: '0.3000',
    karmaReward: 30,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
  },

  // In review
  {
    title: 'Write API documentation',
    description:
      'Document all REST API endpoints with examples, request/response schemas, and error codes.',
    status: 'review',
    priority: 'medium',
    assignedTo: null,
    claimedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    deliverableUrl: 'https://docs.example.com/api',
    deliverableNotes: 'Completed initial documentation. Ready for review.',
    equityReward: '0.2000',
    karmaReward: 20,
  },

  // Completed task
  {
    title: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment.',
    status: 'completed',
    priority: 'high',
    assignedTo: null,
    claimedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    deliverableUrl: 'https://github.com/example/repo/actions',
    deliverableNotes: 'Pipeline configured with test, build, and deploy stages.',
    equityReward: '0.4000',
    karmaReward: 40,
  },

  // Cancelled task
  {
    title: 'Integrate legacy payment system',
    description: 'Connect to the old payment API for backward compatibility.',
    status: 'cancelled',
    priority: 'low',
    equityReward: '0.1000',
    karmaReward: 10,
  },

  // Urgent open task
  {
    title: 'Fix critical security vulnerability',
    description: 'Patch the SQL injection vulnerability in the search endpoint immediately.',
    status: 'open',
    priority: 'urgent',
    equityReward: '1.0000',
    karmaReward: 100,
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
  },

  // Low priority backlog item
  {
    title: 'Improve error messages',
    description: 'Make error messages more user-friendly and actionable.',
    status: 'open',
    priority: 'low',
    equityReward: '0.0500',
    karmaReward: 5,
  },
];

// ============================================================================
// INDIVIDUAL REFERENCES
// ============================================================================

export const openTask = testTasks[0];
export const inProgressTask = testTasks[1];
export const reviewTask = testTasks[2];
export const completedTask = testTasks[3];
export const cancelledTask = testTasks[4];
export const urgentTask = testTasks[5];
export const lowPriorityTask = testTasks[6];

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a custom test task
 */
export function createTaskFixture(
  overrides: Partial<Omit<TaskInsert, 'companyId' | 'createdBy'>> = {}
): Omit<TaskInsert, 'companyId' | 'createdBy'> {
  const timestamp = Date.now();
  return {
    title: `Test Task ${timestamp}`,
    description: 'Auto-generated test task',
    status: 'open',
    priority: 'medium',
    equityReward: '0.1000',
    karmaReward: 10,
    ...overrides,
  };
}

/**
 * Create multiple tasks
 */
export function createTaskFixtures(
  count: number,
  baseOverrides: Partial<Omit<TaskInsert, 'companyId' | 'createdBy'>> = {}
): Omit<TaskInsert, 'companyId' | 'createdBy'>[] {
  return Array.from({ length: count }, (_, i) =>
    createTaskFixture({
      title: `Batch Task ${i + 1}`,
      ...baseOverrides,
    })
  );
}

// ============================================================================
// STATUS WORKFLOW HELPERS
// ============================================================================

/**
 * Get all valid status transitions
 */
export const validStatusTransitions: Record<string, string[]> = {
  open: ['claimed'],
  claimed: ['in_progress', 'open'], // Can unclaim
  in_progress: ['review', 'cancelled'],
  review: ['completed', 'in_progress'], // Can send back for revision
  completed: [], // Terminal state
  cancelled: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: string, to: string): boolean {
  return validStatusTransitions[from]?.includes(to) ?? false;
}

// ============================================================================
// PRIORITY HELPERS
// ============================================================================

export const priorityOrder = ['low', 'medium', 'high', 'urgent'] as const;

export function comparePriority(a: string, b: string): number {
  return priorityOrder.indexOf(a as any) - priorityOrder.indexOf(b as any);
}
