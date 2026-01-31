/**
 * Unit Tests: Cursor Pagination
 *
 * Tests cursor encoding/decoding, pagination result building,
 * and pagination option normalization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  paginateResults,
  normalizePaginationOptions,
  parsePaginationParams,
} from '@/utils/pagination';
import type { PaginationOptions, CursorData } from '@/types/pagination';

// ============================================================================
// TEST FIXTURES
// ============================================================================

interface TestItem {
  id: string;
  name: string;
  createdAt: string;
}

const createTestItems = (count: number): TestItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Item ${i + 1}`,
    createdAt: new Date(Date.now() - i * 1000).toISOString(),
  }));
};

// ============================================================================
// TESTS
// ============================================================================

describe('Cursor Pagination', () => {
  describe('encodeCursor', () => {
    it('encodes cursor correctly with string sortValue', () => {
      const cursorData: CursorData = {
        sortValue: 'test-value',
        id: 'item-123',
        sortField: 'name',
        sortOrder: 'asc',
      };

      const encoded = encodeCursor(cursorData);

      // Should be a valid base64url string
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);

      // Should be decodeable
      const decoded = decodeCursor(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.sortValue).toBe('test-value');
      expect(decoded?.id).toBe('item-123');
    });

    it('encodes cursor correctly with Date sortValue', () => {
      const date = new Date('2025-01-31T12:00:00Z');
      const cursorData: CursorData = {
        sortValue: date,
        id: 'item-456',
        sortField: 'createdAt',
        sortOrder: 'desc',
      };

      const encoded = encodeCursor(cursorData);
      const decoded = decodeCursor(encoded);

      expect(decoded?.sortValue).toBe(date.toISOString());
    });

    it('encodes cursor correctly with numeric sortValue', () => {
      const cursorData: CursorData = {
        sortValue: 42,
        id: 'item-789',
        sortField: 'score',
        sortOrder: 'desc',
      };

      const encoded = encodeCursor(cursorData);
      const decoded = decodeCursor(encoded);

      expect(decoded?.sortValue).toBe(42);
    });
  });

  describe('decodeCursor', () => {
    it('decodes cursor correctly', () => {
      const cursorData: CursorData = {
        sortValue: '2025-01-31T12:00:00.000Z',
        id: 'item-123',
        sortField: 'createdAt',
        sortOrder: 'desc',
      };

      const encoded = encodeCursor(cursorData);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual({
        sortValue: '2025-01-31T12:00:00.000Z',
        id: 'item-123',
        sortField: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('returns null for invalid base64', () => {
      const decoded = decodeCursor('not-valid-base64!!!');

      expect(decoded).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      const malformedBase64 = Buffer.from('not json').toString('base64url');
      const decoded = decodeCursor(malformedBase64);

      expect(decoded).toBeNull();
    });

    it('returns null for missing required fields', () => {
      const incompleteData = { sv: 'value', id: '123' }; // missing sf and so
      const encoded = Buffer.from(JSON.stringify(incompleteData)).toString('base64url');
      const decoded = decodeCursor(encoded);

      expect(decoded).toBeNull();
    });

    it('returns null for empty string', () => {
      const decoded = decodeCursor('');

      expect(decoded).toBeNull();
    });
  });

  describe('paginateResults', () => {
    it('handles first page correctly', () => {
      const items = createTestItems(25); // More than limit
      const options = { limit: 20, cursor: '', sortField: 'createdAt', sortOrder: 'desc' as const };

      const result = paginateResults(items, options, 'createdAt');

      expect(result.items).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('handles last page correctly', () => {
      const items = createTestItems(15); // Less than limit
      const options = { limit: 20, cursor: '', sortField: 'createdAt', sortOrder: 'desc' as const };

      const result = paginateResults(items, options, 'createdAt');

      expect(result.items).toHaveLength(15);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('handles exact limit items', () => {
      const items = createTestItems(20); // Exactly limit
      const options = { limit: 20, cursor: '', sortField: 'createdAt', sortOrder: 'desc' as const };

      const result = paginateResults(items, options, 'createdAt');

      expect(result.items).toHaveLength(20);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('handles limit + 1 items (has more)', () => {
      const items = createTestItems(21); // Exactly limit + 1
      const options = { limit: 20, cursor: '', sortField: 'createdAt', sortOrder: 'desc' as const };

      const result = paginateResults(items, options, 'createdAt');

      expect(result.items).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('handles empty results', () => {
      const items: TestItem[] = [];
      const options = { limit: 20, cursor: '', sortField: 'createdAt', sortOrder: 'desc' as const };

      const result = paginateResults(items, options, 'createdAt');

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('generates cursor with correct last item data', () => {
      const items = createTestItems(25);
      const options = { limit: 20, cursor: '', sortField: 'createdAt', sortOrder: 'desc' as const };

      const result = paginateResults(items, options, 'createdAt');
      const cursor = decodeCursor(result.nextCursor!);

      expect(cursor).not.toBeNull();
      expect(cursor?.id).toBe('item-20');
      expect(cursor?.sortField).toBe('createdAt');
      expect(cursor?.sortOrder).toBe('desc');
    });
  });

  describe('normalizePaginationOptions', () => {
    it('applies default values for missing options', () => {
      const options: PaginationOptions = {};

      const normalized = normalizePaginationOptions(options);

      expect(normalized.limit).toBe(20);
      expect(normalized.cursor).toBe('');
      expect(normalized.sortField).toBe('createdAt');
      expect(normalized.sortOrder).toBe('desc');
    });

    it('respects provided values', () => {
      const options: PaginationOptions = {
        limit: 50,
        cursor: 'abc123',
        sortField: 'name',
        sortOrder: 'asc',
      };

      const normalized = normalizePaginationOptions(options);

      expect(normalized.limit).toBe(50);
      expect(normalized.cursor).toBe('abc123');
      expect(normalized.sortField).toBe('name');
      expect(normalized.sortOrder).toBe('asc');
    });

    it('enforces maximum limit', () => {
      const options: PaginationOptions = { limit: 500 };

      const normalized = normalizePaginationOptions(options);

      expect(normalized.limit).toBe(100); // MAX_LIMIT
    });

    it('enforces minimum limit', () => {
      // When limit is 0, it's treated as falsy and defaults to PAGINATION_DEFAULTS.LIMIT
      // The actual minimum (1) is only enforced via Math.max
      const options: PaginationOptions = { limit: -5 };

      const normalized = normalizePaginationOptions(options);

      // Math.max(1, -5) = 1, then Math.min(1, 100) = 1
      expect(normalized.limit).toBe(1);
    });

    it('treats zero limit as default (falsy)', () => {
      // 0 is falsy, so falls back to default (20)
      const options: PaginationOptions = { limit: 0 };

      const normalized = normalizePaginationOptions(options);

      expect(normalized.limit).toBe(20);
    });

    it('handles negative limit', () => {
      const options: PaginationOptions = { limit: -10 };

      const normalized = normalizePaginationOptions(options);

      expect(normalized.limit).toBe(1);
    });

    it('accepts custom defaults', () => {
      const options: PaginationOptions = {};
      const customDefaults = {
        LIMIT: 10,
        MAX_LIMIT: 50,
        SORT_FIELD: 'updatedAt',
        SORT_ORDER: 'asc' as const,
      };

      const normalized = normalizePaginationOptions(options, customDefaults);

      expect(normalized.limit).toBe(10);
      expect(normalized.sortField).toBe('updatedAt');
      expect(normalized.sortOrder).toBe('asc');
    });
  });

  describe('parsePaginationParams', () => {
    it('parses query parameters correctly', () => {
      const params = {
        limit: '25',
        cursor: 'abc123',
        sort_field: 'name',
        sort_order: 'asc',
      };

      const parsed = parsePaginationParams(params);

      expect(parsed.limit).toBe(25);
      expect(parsed.cursor).toBe('abc123');
      expect(parsed.sortField).toBe('name');
      expect(parsed.sortOrder).toBe('asc');
    });

    it('handles missing parameters', () => {
      const params = {};

      const parsed = parsePaginationParams(params);

      expect(parsed.limit).toBeUndefined();
      expect(parsed.cursor).toBeUndefined();
      expect(parsed.sortField).toBeUndefined();
      expect(parsed.sortOrder).toBeUndefined();
    });

    it('handles camelCase parameter names', () => {
      const params = {
        sortField: 'name',
        sortOrder: 'desc',
      };

      const parsed = parsePaginationParams(params);

      expect(parsed.sortField).toBe('name');
      expect(parsed.sortOrder).toBe('desc');
    });

    it('prefers snake_case over camelCase', () => {
      const params = {
        sort_field: 'snake',
        sortField: 'camel',
      };

      const parsed = parsePaginationParams(params);

      expect(parsed.sortField).toBe('snake');
    });

    it('only accepts valid sort order values', () => {
      const paramsAsc = { sort_order: 'asc' };
      const paramsDesc = { sort_order: 'desc' };
      const paramsInvalid = { sort_order: 'random' };

      expect(parsePaginationParams(paramsAsc).sortOrder).toBe('asc');
      expect(parsePaginationParams(paramsDesc).sortOrder).toBe('desc');
      expect(parsePaginationParams(paramsInvalid).sortOrder).toBeUndefined();
    });

    it('handles non-numeric limit gracefully', () => {
      const params = { limit: 'not-a-number' };

      const parsed = parsePaginationParams(params);

      expect(parsed.limit).toBeNaN();
    });
  });

  describe('Cursor Round-trip', () => {
    it('cursor survives encode/decode round-trip', () => {
      const original: CursorData = {
        sortValue: '2025-01-31T12:00:00.000Z',
        id: 'uuid-12345',
        sortField: 'createdAt',
        sortOrder: 'desc',
      };

      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(original);
    });

    it('handles special characters in values', () => {
      const original: CursorData = {
        sortValue: 'value with spaces & special <chars>',
        id: 'id-with-dashes-123',
        sortField: 'field_name',
        sortOrder: 'asc',
      };

      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);

      expect(decoded?.sortValue).toBe(original.sortValue);
    });

    it('handles unicode in values', () => {
      const original: CursorData = {
        sortValue: 'Unicode test: emoji stars',
        id: 'unicode-id',
        sortField: 'name',
        sortOrder: 'desc',
      };

      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);

      expect(decoded?.sortValue).toBe(original.sortValue);
    });
  });
});
