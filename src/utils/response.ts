// ============================================================================
// API RESPONSE HELPERS
// ============================================================================

import type { PaginatedResult } from '../types/pagination';
import type { ApiError } from './errors';

/**
 * Standard success response structure
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    hint?: string;
  };
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    total?: number;
  };
  meta?: Record<string, unknown>;
}

/**
 * Create a success response
 */
export function success<T>(
  data: T,
  meta?: Record<string, unknown>,
): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

/**
 * Create an error response
 */
export function error(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  hint?: string,
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(hint && { hint }),
    },
  };
}

/**
 * Create an error response from an ApiError
 */
export function errorFromApiError(err: ApiError): ErrorResponse {
  return err.toJSON() as ErrorResponse;
}

/**
 * Create a paginated response
 */
export function paginated<T>(
  result: PaginatedResult<T>,
  meta?: Record<string, unknown>,
): PaginatedResponse<T> {
  return {
    success: true,
    data: result.items,
    pagination: {
      next_cursor: result.nextCursor,
      has_more: result.hasMore,
      ...(result.total !== undefined && { total: result.total }),
    },
    ...(meta && { meta }),
  };
}

/**
 * Create a created response with location header hint
 */
export function created<T>(
  data: T,
  resourceUrl?: string,
): SuccessResponse<T> & { meta?: { location?: string } } {
  return {
    success: true,
    data,
    ...(resourceUrl && { meta: { location: resourceUrl } }),
  };
}

/**
 * Create an accepted response (for async operations)
 */
export function accepted(
  message: string = 'Request accepted for processing',
  meta?: Record<string, unknown>,
): { success: true; message: string; meta?: Record<string, unknown> } {
  return {
    success: true,
    message,
    ...(meta && { meta }),
  };
}

/**
 * Create a no content indicator
 * (Use with 204 status code - actual response body should be empty)
 */
export function noContent(): null {
  return null;
}

/**
 * Create a list response with optional metadata
 */
export function list<T>(
  items: T[],
  meta?: Record<string, unknown>,
): { success: true; data: T[]; count: number; meta?: Record<string, unknown> } {
  return {
    success: true,
    data: items,
    count: items.length,
    ...(meta && { meta }),
  };
}

/**
 * Wrap data in a consistent response envelope
 * Useful for transforming existing responses
 */
export function wrap<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create a message-only success response
 * Useful for operations that don't return data
 */
export function message(
  msg: string,
  meta?: Record<string, unknown>,
): { success: true; message: string; meta?: Record<string, unknown> } {
  return {
    success: true,
    message: msg,
    ...(meta && { meta }),
  };
}
