// ============================================================================
// PAGINATION UTILITIES
// ============================================================================

import { sql, gt, lt, and, asc, desc, SQL } from 'drizzle-orm';
import type {
  PaginationOptions,
  PaginatedResult,
  CursorData,
  PAGINATION_DEFAULTS,
} from '../types/pagination';

/**
 * Encode cursor data to a base64 string
 */
export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify({
    sv: data.sortValue instanceof Date ? data.sortValue.toISOString() : data.sortValue,
    id: data.id,
    sf: data.sortField,
    so: data.sortOrder,
  });
  return Buffer.from(json).toString('base64url');
}

/**
 * Decode a base64 cursor string to cursor data
 * Returns null if the cursor is invalid
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);

    if (!parsed.sv || !parsed.id || !parsed.sf || !parsed.so) {
      return null;
    }

    return {
      sortValue: parsed.sv,
      id: parsed.id,
      sortField: parsed.sf,
      sortOrder: parsed.so,
    };
  } catch {
    return null;
  }
}

/**
 * Build pagination where clause for cursor-based pagination
 * Uses the (sortField, id) tuple for stable pagination
 */
export function buildCursorWhereClause(
  table: any,
  cursorData: CursorData,
): SQL | undefined {
  const sortColumn = table[cursorData.sortField];
  const idColumn = table.id;

  if (!sortColumn || !idColumn) {
    return undefined;
  }

  // For ascending: (sortField > cursorValue) OR (sortField = cursorValue AND id > cursorId)
  // For descending: (sortField < cursorValue) OR (sortField = cursorValue AND id < cursorId)
  const compareOp = cursorData.sortOrder === 'asc' ? gt : lt;

  return sql`(${sortColumn} ${cursorData.sortOrder === 'asc' ? sql`>` : sql`<`} ${cursorData.sortValue}) OR (${sortColumn} = ${cursorData.sortValue} AND ${idColumn} ${cursorData.sortOrder === 'asc' ? sql`>` : sql`<`} ${cursorData.id})`;
}

/**
 * Build order by clause for pagination
 */
export function buildOrderByClause(
  table: any,
  sortField: string,
  sortOrder: 'asc' | 'desc',
): SQL[] {
  const sortColumn = table[sortField];
  const idColumn = table.id;
  const orderFn = sortOrder === 'asc' ? asc : desc;

  if (!sortColumn || !idColumn) {
    return [orderFn(idColumn)];
  }

  return [orderFn(sortColumn), orderFn(idColumn)];
}

/**
 * Paginate query results with cursor-based pagination
 *
 * @param items - Array of items from the database query
 * @param options - Pagination options
 * @param getItemValue - Function to extract sort value and id from an item
 * @returns Paginated result with items, cursor, and hasMore flag
 */
export function paginateResults<T extends { id: string }>(
  items: T[],
  options: Required<PaginationOptions>,
  sortField: string,
): PaginatedResult<T> {
  const { limit, sortOrder } = options;

  // We fetch limit + 1 to check if there are more items
  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;

  if (hasMore && resultItems.length > 0) {
    const lastItem = resultItems[resultItems.length - 1];
    const sortValue = (lastItem as any)[sortField];

    nextCursor = encodeCursor({
      sortValue,
      id: lastItem.id,
      sortField,
      sortOrder,
    });
  }

  return {
    items: resultItems,
    nextCursor,
    hasMore,
  };
}

/**
 * Normalize pagination options with defaults
 */
export function normalizePaginationOptions(
  options: PaginationOptions,
  defaults: typeof PAGINATION_DEFAULTS = {
    LIMIT: 20,
    MAX_LIMIT: 100,
    SORT_FIELD: 'createdAt',
    SORT_ORDER: 'desc',
  },
): Required<PaginationOptions> {
  const limit = Math.min(
    Math.max(1, options.limit || defaults.LIMIT),
    defaults.MAX_LIMIT,
  );

  return {
    limit,
    cursor: options.cursor || '',
    sortField: options.sortField || defaults.SORT_FIELD,
    sortOrder: options.sortOrder || defaults.SORT_ORDER,
  };
}

/**
 * Parse pagination query parameters from request
 */
export function parsePaginationParams(params: Record<string, string | undefined>): PaginationOptions {
  return {
    limit: params.limit ? parseInt(params.limit, 10) : undefined,
    cursor: params.cursor,
    sortField: params.sort_field || params.sortField,
    sortOrder: params.sort_order === 'asc' || params.sortOrder === 'asc' ? 'asc' :
               params.sort_order === 'desc' || params.sortOrder === 'desc' ? 'desc' : undefined,
  };
}
