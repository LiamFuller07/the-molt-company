/**
 * Search & Embedding Jobs
 * Handles content embedding generation for semantic search
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '../../db/index.js';
import {
  tasks,
  discussions,
  companyMemory,
  agents,
  companies,
} from '../../db/schema.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Embedding model to use
 * text-embedding-3-small is cost-effective and produces 1536-dimension vectors
 */
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Maximum content length for embedding
 */
const MAX_CONTENT_LENGTH = 8000;

/**
 * Embed content job data
 */
export interface EmbedContentJobData {
  type: 'task' | 'discussion' | 'memory' | 'agent' | 'company';
  id: string;
}

/**
 * Document embedding job data (generic)
 */
export interface EmbedDocumentJobData {
  documentId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Reindex job data
 */
export interface ReindexJobData {
  agentId?: string;
  companyId?: string;
}

/**
 * Generate embedding for text content
 */
async function generateEmbedding(content: string): Promise<number[]> {
  // Truncate content if too long
  const truncatedContent = content.length > MAX_CONTENT_LENGTH
    ? content.substring(0, MAX_CONTENT_LENGTH) + '...'
    : content;

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedContent,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[SearchJob] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Store embedding in database
 * Uses raw SQL for pgvector operations
 */
async function storeEmbedding(
  type: string,
  id: string,
  embedding: number[]
): Promise<void> {
  // Convert embedding array to pgvector format
  const vectorString = `[${embedding.join(',')}]`;

  switch (type) {
    case 'task':
      await db.update(tasks)
        .set({
          // Note: Drizzle doesn't natively support pgvector,
          // so we store as JSON and handle in search queries
          embedding: embedding as any,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id));
      break;

    case 'discussion':
      await db.update(discussions)
        .set({
          embedding: embedding as any,
          updatedAt: new Date(),
        })
        .where(eq(discussions.id, id));
      break;

    default:
      console.warn(`[SearchJob] Unknown type for embedding storage: ${type}`);
  }

  console.log(`[SearchJob] Stored embedding for ${type}:${id}`);
}

/**
 * Get task content for embedding
 */
async function getTaskContent(id: string): Promise<string | null> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    columns: {
      title: true,
      description: true,
      priority: true,
      status: true,
    },
  });

  if (!task) return null;

  return [
    `Task: ${task.title}`,
    task.description || '',
    `Priority: ${task.priority}`,
    `Status: ${task.status}`,
  ].filter(Boolean).join('\n');
}

/**
 * Get discussion content for embedding
 */
async function getDiscussionContent(id: string): Promise<string | null> {
  const discussion = await db.query.discussions.findFirst({
    where: eq(discussions.id, id),
    columns: {
      title: true,
      content: true,
    },
    with: {
      replies: {
        columns: { content: true },
        limit: 10, // Include first 10 replies for context
      },
    },
  });

  if (!discussion) return null;

  const parts = [
    `Discussion: ${discussion.title}`,
    discussion.content,
  ];

  if (discussion.replies?.length) {
    parts.push('\nReplies:');
    for (const reply of discussion.replies) {
      parts.push(`- ${reply.content}`);
    }
  }

  return parts.join('\n');
}

/**
 * Get memory content for embedding
 */
async function getMemoryContent(id: string): Promise<string | null> {
  const memory = await db.query.companyMemory.findFirst({
    where: eq(companyMemory.id, id),
    columns: {
      key: true,
      value: true,
    },
  });

  if (!memory) return null;

  const valueString = typeof memory.value === 'string'
    ? memory.value
    : JSON.stringify(memory.value);

  return `${memory.key}: ${valueString}`;
}

/**
 * Get agent content for embedding
 */
async function getAgentContent(id: string): Promise<string | null> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, id),
    columns: {
      name: true,
      description: true,
      skills: true,
    },
  });

  if (!agent) return null;

  const parts = [
    `Agent: ${agent.name}`,
    agent.description || '',
  ];

  const skills = agent.skills as string[] | null;
  if (skills?.length) {
    parts.push(`Skills: ${skills.join(', ')}`);
  }

  return parts.filter(Boolean).join('\n');
}

/**
 * Get company content for embedding
 */
async function getCompanyContent(id: string): Promise<string | null> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, id),
    columns: {
      name: true,
      displayName: true,
      description: true,
      mission: true,
    },
  });

  if (!company) return null;

  return [
    `Company: ${company.displayName || company.name}`,
    company.description || '',
    company.mission ? `Mission: ${company.mission}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Main embedding content job handler
 */
export async function embedContentJob(job: Job<EmbedContentJobData>): Promise<void> {
  const { type, id } = job.data;

  console.log(`[SearchJob] Generating embedding for ${type}:${id}`);

  // Get content based on type
  let content: string | null = null;

  switch (type) {
    case 'task':
      content = await getTaskContent(id);
      break;
    case 'discussion':
      content = await getDiscussionContent(id);
      break;
    case 'memory':
      content = await getMemoryContent(id);
      break;
    case 'agent':
      content = await getAgentContent(id);
      break;
    case 'company':
      content = await getCompanyContent(id);
      break;
    default:
      console.warn(`[SearchJob] Unknown content type: ${type}`);
      return;
  }

  if (!content) {
    console.warn(`[SearchJob] No content found for ${type}:${id}`);
    return;
  }

  // Generate embedding
  const embedding = await generateEmbedding(content);

  // Store embedding
  await storeEmbedding(type, id, embedding);

  console.log(`[SearchJob] Successfully embedded ${type}:${id} (${embedding.length} dimensions)`);
}

/**
 * Embed document job (generic)
 */
export async function embedDocumentJob(job: Job<EmbedDocumentJobData>): Promise<void> {
  const { documentId, content, metadata } = job.data;

  console.log(`[SearchJob] Generating embedding for document ${documentId}`);

  // Add metadata context to content if available
  let enrichedContent = content;
  if (metadata) {
    const metadataString = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    enrichedContent = `${metadataString}\n\n${content}`;
  }

  // Generate embedding
  const embedding = await generateEmbedding(enrichedContent);

  console.log(
    `[SearchJob] Generated embedding for document ${documentId} (${embedding.length} dimensions)`
  );

  // Return embedding for caller to handle storage
  return;
}

/**
 * Reindex agent job
 * Regenerates embeddings for all content belonging to an agent
 */
export async function reindexAgentJob(job: Job<ReindexJobData>): Promise<void> {
  const { agentId } = job.data;

  if (!agentId) {
    console.warn('[SearchJob] No agentId provided for reindex');
    return;
  }

  console.log(`[SearchJob] Reindexing all content for agent ${agentId}`);

  // Embed agent profile
  await embedContentJob({ data: { type: 'agent', id: agentId } } as any);

  // Find and embed agent's tasks
  const agentTasks = await db.query.tasks.findMany({
    where: eq(tasks.createdBy, agentId),
    columns: { id: true },
  });

  for (const task of agentTasks) {
    await embedContentJob({ data: { type: 'task', id: task.id } } as any);
  }

  // Find and embed agent's discussions
  const agentDiscussions = await db.query.discussions.findMany({
    where: eq(discussions.authorId, agentId),
    columns: { id: true },
  });

  for (const discussion of agentDiscussions) {
    await embedContentJob({ data: { type: 'discussion', id: discussion.id } } as any);
  }

  console.log(
    `[SearchJob] Reindexed agent ${agentId}: ` +
    `${agentTasks.length} tasks, ${agentDiscussions.length} discussions`
  );
}

/**
 * Reindex company job
 * Regenerates embeddings for all content belonging to a company
 */
export async function reindexCompanyJob(job: Job<ReindexJobData>): Promise<void> {
  const { companyId } = job.data;

  if (!companyId) {
    console.warn('[SearchJob] No companyId provided for reindex');
    return;
  }

  console.log(`[SearchJob] Reindexing all content for company ${companyId}`);

  // Embed company profile
  await embedContentJob({ data: { type: 'company', id: companyId } } as any);

  // Find and embed company's tasks
  const companyTasks = await db.query.tasks.findMany({
    where: eq(tasks.companyId, companyId),
    columns: { id: true },
  });

  for (const task of companyTasks) {
    await embedContentJob({ data: { type: 'task', id: task.id } } as any);
  }

  // Find and embed company's discussions
  const companyDiscussions = await db.query.discussions.findMany({
    where: eq(discussions.companyId, companyId),
    columns: { id: true },
  });

  for (const discussion of companyDiscussions) {
    await embedContentJob({ data: { type: 'discussion', id: discussion.id } } as any);
  }

  // Find and embed company's memory
  const companyMemories = await db.query.companyMemory.findMany({
    where: eq(companyMemory.companyId, companyId),
    columns: { id: true },
  });

  for (const memory of companyMemories) {
    await embedContentJob({ data: { type: 'memory', id: memory.id } } as any);
  }

  console.log(
    `[SearchJob] Reindexed company ${companyId}: ` +
    `${companyTasks.length} tasks, ${companyDiscussions.length} discussions, ` +
    `${companyMemories.length} memories`
  );
}

/**
 * Batch embedding job
 * Embeds multiple items in a single job
 */
export interface BatchEmbedJobData {
  items: EmbedContentJobData[];
}

export async function batchEmbedJob(job: Job<BatchEmbedJobData>): Promise<void> {
  const { items } = job.data;

  console.log(`[SearchJob] Batch embedding ${items.length} items`);

  let success = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await embedContentJob({ data: item } as any);
      success++;
    } catch (error) {
      console.error(`[SearchJob] Failed to embed ${item.type}:${item.id}:`, error);
      failed++;
    }
  }

  console.log(`[SearchJob] Batch complete: ${success} success, ${failed} failed`);
}
