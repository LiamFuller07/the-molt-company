/**
 * Job Processor Factory
 * Generic processor wrapper with error handling and logging
 */

import { Job, Processor } from 'bullmq';
import { captureError, addBreadcrumb } from '../lib/sentry.js';

/**
 * Job context provided to processors
 */
export interface JobContext {
  jobId: string;
  jobName: string;
  attemptsMade: number;
  maxAttempts: number;
  timestamp: Date;
}

/**
 * Handler function signature
 */
export type JobHandler<T = unknown, R = void> = (
  data: T,
  context: JobContext
) => Promise<R>;

/**
 * Create a processor with standardized error handling and logging
 */
export function createProcessor<T = unknown, R = void>(
  queueName: string,
  handler: JobHandler<T, R>
): Processor<T, R> {
  return async (job: Job<T>): Promise<R> => {
    const startTime = Date.now();
    const context: JobContext = {
      jobId: job.id || 'unknown',
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts?.attempts || 1,
      timestamp: new Date(),
    };

    console.log(
      `[${queueName}] Processing job ${context.jobName}:${context.jobId} ` +
      `(attempt ${context.attemptsMade + 1}/${context.maxAttempts})`
    );

    try {
      const result = await handler(job.data, context);

      const duration = Date.now() - startTime;
      console.log(
        `[${queueName}] Job ${context.jobName}:${context.jobId} completed in ${duration}ms`
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const isLastAttempt = context.attemptsMade + 1 >= context.maxAttempts;

      console.error(
        `[${queueName}] Job ${context.jobName}:${context.jobId} failed after ${duration}ms ` +
        `(attempt ${context.attemptsMade + 1}/${context.maxAttempts})`,
        error instanceof Error ? error.message : error
      );

      // Capture error in Sentry
      if (error instanceof Error) {
        captureError(error, {
          tags: {
            queue: queueName,
            job_name: context.jobName,
            is_last_attempt: String(isLastAttempt),
          },
          extra: {
            jobId: context.jobId,
            attemptsMade: context.attemptsMade,
            maxAttempts: context.maxAttempts,
            duration,
          },
        });
      }

      if (isLastAttempt) {
        console.error(
          `[${queueName}] Job ${context.jobName}:${context.jobId} exhausted all retries, ` +
          `moving to DLQ`
        );
      }

      throw error;
    }
  };
}

/**
 * Create a batch processor for handling multiple items in a single job
 */
export function createBatchProcessor<T = unknown, R = void>(
  queueName: string,
  itemHandler: (item: T, index: number, context: JobContext) => Promise<R>,
  options: { continueOnError?: boolean } = {}
): Processor<T[], R[]> {
  return createProcessor<T[], R[]>(queueName, async (items, context) => {
    const results: R[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await itemHandler(items[i], i, context);
        results.push(result);
      } catch (error) {
        if (options.continueOnError) {
          errors.push({ index: i, error: error as Error });
          results.push(undefined as R);
        } else {
          throw error;
        }
      }
    }

    if (errors.length > 0) {
      console.warn(
        `[${queueName}] Batch job ${context.jobId} completed with ${errors.length} errors`
      );
    }

    return results;
  });
}

/**
 * Create a processor that updates job progress
 */
export function createProgressProcessor<T = unknown, R = void>(
  queueName: string,
  handler: (
    data: T,
    context: JobContext,
    updateProgress: (progress: number) => Promise<void>
  ) => Promise<R>
): Processor<T, R> {
  return async (job: Job<T>): Promise<R> => {
    const startTime = Date.now();
    const context: JobContext = {
      jobId: job.id || 'unknown',
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts?.attempts || 1,
      timestamp: new Date(),
    };

    console.log(
      `[${queueName}] Processing job ${context.jobName}:${context.jobId} with progress tracking`
    );

    const updateProgress = async (progress: number): Promise<void> => {
      await job.updateProgress(Math.min(100, Math.max(0, progress)));
    };

    try {
      const result = await handler(job.data, context, updateProgress);

      const duration = Date.now() - startTime;
      console.log(
        `[${queueName}] Job ${context.jobName}:${context.jobId} completed in ${duration}ms`
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[${queueName}] Job ${context.jobName}:${context.jobId} failed after ${duration}ms`,
        error
      );
      throw error;
    }
  };
}
