/**
 * Space (Discussion) Test Fixtures
 * Sample discussion/thread data for testing
 */
import type { discussions, discussionReplies } from '../../src/db/schema';
import type { InferInsertModel } from 'drizzle-orm';

type DiscussionInsert = InferInsertModel<typeof discussions>;
type ReplyInsert = InferInsertModel<typeof discussionReplies>;

// ============================================================================
// TEST DISCUSSIONS (SPACES)
// ============================================================================

/**
 * Collection of test discussions
 * Note: companyId, authorId will be set during seeding
 */
export const testSpaces: Omit<DiscussionInsert, 'companyId' | 'authorId'>[] = [
  // Pinned announcement
  {
    title: 'Welcome to AI Tools Inc!',
    content:
      'Welcome to our company space! This is where we discuss ideas, share updates, and collaborate on projects. ' +
      'Please introduce yourself and feel free to start new discussions.',
    upvotes: 15,
    downvotes: 0,
    replyCount: 8,
    isPinned: true,
    isLocked: false,
    lastActivityAt: new Date(),
  },

  // Active discussion
  {
    title: 'Should we use React or Vue for the new dashboard?',
    content:
      'We need to decide on a frontend framework for our upcoming dashboard project. ' +
      "I've worked with both and see pros and cons to each. What does everyone think?",
    upvotes: 12,
    downvotes: 2,
    replyCount: 15,
    isPinned: false,
    isLocked: false,
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },

  // Technical discussion
  {
    title: 'API Rate Limiting Strategy',
    content:
      'We need to implement rate limiting for our public API. Currently considering:\n' +
      '1. Token bucket algorithm\n' +
      '2. Sliding window\n' +
      '3. Fixed window\n\n' +
      'Thoughts on the best approach?',
    upvotes: 8,
    downvotes: 0,
    replyCount: 6,
    isPinned: false,
    isLocked: false,
    lastActivityAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },

  // Locked historical discussion
  {
    title: '[RESOLVED] Database Migration Issue',
    content:
      'We encountered an issue with the latest database migration. This thread documents the problem and solution.',
    upvotes: 5,
    downvotes: 0,
    replyCount: 12,
    isPinned: false,
    isLocked: true,
    lastActivityAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
  },

  // Idea discussion
  {
    title: 'Feature Request: Dark Mode',
    content:
      'Many users have requested dark mode for our application. Should we prioritize this in the next sprint?',
    upvotes: 20,
    downvotes: 1,
    replyCount: 10,
    isPinned: false,
    isLocked: false,
    lastActivityAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  },
];

// ============================================================================
// TEST REPLIES
// ============================================================================

/**
 * Test replies for discussions
 * Note: discussionId, authorId, parentId will be set during seeding
 */
export const testReplies: Omit<ReplyInsert, 'discussionId' | 'authorId'>[] = [
  // Top-level reply
  {
    content: "Great idea! I think we should definitely prioritize this. It's a common user request.",
    upvotes: 5,
    downvotes: 0,
  },

  // Nested reply (will need parentId set)
  {
    content: "I agree. Let me share some research I've done on implementation approaches.",
    upvotes: 3,
    downvotes: 0,
  },

  // Technical response
  {
    content:
      "Based on my experience, I'd recommend the token bucket algorithm. It's more flexible for handling burst traffic.",
    upvotes: 8,
    downvotes: 1,
  },

  // Question
  {
    content: 'Has anyone considered the performance implications? I have some concerns about memory usage.',
    upvotes: 4,
    downvotes: 0,
  },

  // Disagreement
  {
    content: "I'm not sure this is the right approach. Let me explain my concerns...",
    upvotes: 2,
    downvotes: 2,
  },
];

// ============================================================================
// INDIVIDUAL REFERENCES
// ============================================================================

export const pinnedSpace = testSpaces[0];
export const activeSpace = testSpaces[1];
export const technicalSpace = testSpaces[2];
export const lockedSpace = testSpaces[3];
export const ideaSpace = testSpaces[4];

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a custom test discussion
 */
export function createSpaceFixture(
  overrides: Partial<Omit<DiscussionInsert, 'companyId' | 'authorId'>> = {}
): Omit<DiscussionInsert, 'companyId' | 'authorId'> {
  const timestamp = Date.now();
  return {
    title: `Test Discussion ${timestamp}`,
    content: 'This is an auto-generated test discussion for testing purposes.',
    upvotes: 0,
    downvotes: 0,
    replyCount: 0,
    isPinned: false,
    isLocked: false,
    lastActivityAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a reply fixture
 */
export function createReplyFixture(
  overrides: Partial<Omit<ReplyInsert, 'discussionId' | 'authorId'>> = {}
): Omit<ReplyInsert, 'discussionId' | 'authorId'> {
  return {
    content: 'This is a test reply.',
    upvotes: 0,
    downvotes: 0,
    ...overrides,
  };
}

/**
 * Create multiple discussions
 */
export function createSpaceFixtures(
  count: number,
  baseOverrides: Partial<Omit<DiscussionInsert, 'companyId' | 'authorId'>> = {}
): Omit<DiscussionInsert, 'companyId' | 'authorId'>[] {
  return Array.from({ length: count }, (_, i) =>
    createSpaceFixture({
      title: `Batch Discussion ${i + 1}`,
      ...baseOverrides,
    })
  );
}

// ============================================================================
// DISCUSSION HELPERS
// ============================================================================

/**
 * Calculate net votes (upvotes - downvotes)
 */
export function calculateNetVotes(upvotes: number, downvotes: number): number {
  return upvotes - downvotes;
}

/**
 * Calculate vote ratio
 */
export function calculateVoteRatio(upvotes: number, downvotes: number): number {
  const total = upvotes + downvotes;
  if (total === 0) return 0;
  return upvotes / total;
}

/**
 * Sort discussions by engagement
 */
export function sortByEngagement<T extends { upvotes: number; replyCount: number }>(
  discussions: T[]
): T[] {
  return [...discussions].sort((a, b) => {
    const scoreA = a.upvotes * 2 + a.replyCount;
    const scoreB = b.upvotes * 2 + b.replyCount;
    return scoreB - scoreA;
  });
}

// ============================================================================
// CONTENT HELPERS
// ============================================================================

/**
 * Categories/tags for discussions
 */
export const discussionCategories = [
  'announcement',
  'question',
  'idea',
  'technical',
  'feedback',
  'off-topic',
] as const;

/**
 * Generate a realistic discussion title
 */
export function generateDiscussionTitle(category: (typeof discussionCategories)[number]): string {
  const titles: Record<string, string[]> = {
    announcement: [
      'Company Update',
      'New Feature Launch',
      'Team Changes',
      'Important Notice',
    ],
    question: [
      'How do we handle X?',
      'Best practices for Y?',
      'Need help with Z',
      'Quick question about...',
    ],
    idea: [
      'Proposal: New feature',
      'Suggestion for improvement',
      'What if we tried...',
      'Feature request:',
    ],
    technical: [
      'Architecture decision',
      'Performance optimization',
      'Bug investigation',
      'Tech stack discussion',
    ],
    feedback: [
      'Feedback on recent changes',
      'User research findings',
      'Review of X',
      'Retrospective notes',
    ],
    'off-topic': [
      'Random thought',
      'Friday fun',
      'Weekend plans?',
      'Just wanted to share...',
    ],
  };

  const categoryTitles = titles[category];
  return categoryTitles[Math.floor(Math.random() * categoryTitles.length)];
}
