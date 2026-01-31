// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Context, Next, MiddlewareHandler } from 'hono';
import { validationError } from './errors';

// ============================================================================
// COMMON ZOD SCHEMAS
// ============================================================================

/**
 * UUID v4 validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * URL-safe slug validation schema
 * Allows lowercase letters, numbers, and hyphens
 */
export const slugSchema = z
  .string()
  .min(1, 'Slug cannot be empty')
  .max(50, 'Slug cannot exceed 50 characters')
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
    'Slug must start and end with a letter or number, and can only contain lowercase letters, numbers, and hyphens',
  );

/**
 * Agent/company name validation schema
 * More permissive than slug - allows underscores and mixed case
 */
export const nameSchema = z
  .string()
  .min(3, 'Name must be at least 3 characters')
  .max(30, 'Name cannot exceed 30 characters')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
    'Name must start and end with a letter or number, and can only contain letters, numbers, underscores, and hyphens',
  );

/**
 * Cursor validation schema (base64url encoded)
 */
export const cursorSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'Invalid cursor format',
  )
  .optional();

/**
 * Pagination options schema
 */
export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(1).max(100).optional()),
  cursor: cursorSchema,
  sort_field: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email format');

/**
 * URL validation schema
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Date/datetime string validation schema (ISO 8601)
 */
export const dateStringSchema = z
  .string()
  .datetime({ message: 'Invalid date format. Use ISO 8601 (e.g., 2024-01-15T10:30:00Z)' });

/**
 * Positive integer schema
 */
export const positiveIntSchema = z.number().int().positive();

/**
 * Non-negative integer schema
 */
export const nonNegativeIntSchema = z.number().int().min(0);

/**
 * Percentage schema (0-100)
 */
export const percentageSchema = z.number().min(0).max(100);

/**
 * Equity amount schema (decimal string, 0-100)
 */
export const equitySchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Invalid equity format')
  .refine(
    (val) => {
      const num = parseFloat(val);
      return num >= 0 && num <= 100;
    },
    { message: 'Equity must be between 0 and 100' },
  );

/**
 * Skills array schema
 */
export const skillsSchema = z
  .array(z.string().min(1).max(50))
  .max(10, 'Maximum 10 skills allowed')
  .optional()
  .default([]);

/**
 * Metadata object schema (generic JSON object)
 */
export const metadataSchema = z.record(z.unknown()).optional().default({});

/**
 * Search query schema
 */
export const searchQuerySchema = z
  .string()
  .min(1, 'Search query cannot be empty')
  .max(200, 'Search query too long');

/**
 * Task status schema
 */
export const taskStatusSchema = z.enum([
  'open',
  'claimed',
  'in_progress',
  'review',
  'completed',
  'cancelled',
]);

/**
 * Task priority schema
 */
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Decision status schema
 */
export const decisionStatusSchema = z.enum([
  'draft',
  'active',
  'passed',
  'rejected',
  'expired',
]);

/**
 * Voting method schema
 */
export const votingMethodSchema = z.enum([
  'equity_weighted',
  'one_agent_one_vote',
  'unanimous',
]);

/**
 * Member role schema
 */
export const memberRoleSchema = z.enum(['founder', 'member', 'contractor']);

// ============================================================================
// VALIDATION MIDDLEWARE HELPERS
// ============================================================================

/**
 * Create a validation middleware for JSON body
 */
export function validateBody<T extends z.ZodType>(schema: T): MiddlewareHandler {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      const errors = result.error.flatten();
      return c.json(
        validationError('Request validation failed', {
          field_errors: errors.fieldErrors,
          form_errors: errors.formErrors,
        }).toJSON(),
        400,
      );
    }
  });
}

/**
 * Create a validation middleware for query parameters
 */
export function validateQuery<T extends z.ZodType>(schema: T): MiddlewareHandler {
  return zValidator('query', schema, (result, c) => {
    if (!result.success) {
      const errors = result.error.flatten();
      return c.json(
        validationError('Query parameter validation failed', {
          field_errors: errors.fieldErrors,
          form_errors: errors.formErrors,
        }).toJSON(),
        400,
      );
    }
  });
}

/**
 * Create a validation middleware for URL parameters
 */
export function validateParam<T extends z.ZodType>(schema: T): MiddlewareHandler {
  return zValidator('param', schema, (result, c) => {
    if (!result.success) {
      const errors = result.error.flatten();
      return c.json(
        validationError('URL parameter validation failed', {
          field_errors: errors.fieldErrors,
          form_errors: errors.formErrors,
        }).toJSON(),
        400,
      );
    }
  });
}

/**
 * Validate a value against a schema and throw if invalid
 */
export function validate<T>(
  schema: z.ZodType<T>,
  value: unknown,
  errorMessage?: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationError(
      errorMessage || 'Validation failed',
      { errors: result.error.flatten() },
    );
  }
  return result.data;
}

/**
 * Safe validation that returns a result object instead of throwing
 */
export function safeValidate<T>(
  schema: z.ZodType<T>,
  value: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodError['flatten'] } {
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.flatten() };
}

// ============================================================================
// COMMON COMBINED SCHEMAS
// ============================================================================

/**
 * Standard ID parameter schema
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Company name parameter schema
 */
export const companyParamSchema = z.object({
  name: slugSchema,
});

/**
 * Company and resource ID parameter schema
 */
export const companyResourceParamSchema = z.object({
  name: slugSchema,
  id: uuidSchema,
});

/**
 * Agent name parameter schema
 */
export const agentParamSchema = z.object({
  name: nameSchema,
});
