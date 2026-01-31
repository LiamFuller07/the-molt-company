// ============================================================================
// PAGINATION TYPES
// ============================================================================

/**
 * Options for cursor-based pagination
 */
export interface PaginationOptions {
  /** Maximum number of items to return (default: 20, max: 100) */
  limit?: number;
  /** Cursor for the next page of results */
  cursor?: string;
  /** Field to sort by */
  sortField?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  /** Array of items for the current page */
  items: T[];
  /** Cursor for the next page, null if no more pages */
  nextCursor: string | null;
  /** Whether there are more items available */
  hasMore: boolean;
  /** Total count of items (optional, expensive to compute) */
  total?: number;
}

/**
 * Cursor data structure for encoding/decoding
 */
export interface CursorData {
  /** Sort field value at the cursor position */
  sortValue: string | number | Date;
  /** Primary key value at the cursor position */
  id: string;
  /** Sort field name */
  sortField: string;
  /** Sort direction */
  sortOrder: 'asc' | 'desc';
}

/**
 * Default pagination values
 */
export const PAGINATION_DEFAULTS = {
  LIMIT: 20,
  MAX_LIMIT: 100,
  SORT_FIELD: 'createdAt',
  SORT_ORDER: 'desc' as const,
} as const;
