import { describe, expect, it } from 'vitest';
import { paginationMeta, parsePagination } from '../../src/utils/asyncHandler.js';

describe('parsePagination', () => {
  it('defaults to page 1 and limit 20', () => {
    const result = parsePagination({});
    expect(result).toEqual({ page: 1, limit: 20, skip: 0, search: '' });
  });

  it('parses page, limit, and search query params', () => {
    const result = parsePagination({ page: '3', limit: '10', search: 'toy' });
    expect(result).toEqual({ page: 3, limit: 10, skip: 20, search: 'toy' });
  });

  it('accepts q as search alias', () => {
    const result = parsePagination({ q: 'acme' });
    expect(result.search).toBe('acme');
  });

  it('caps limit at 100', () => {
    const result = parsePagination({ limit: '500' });
    expect(result.limit).toBe(100);
  });

  it('never goes below page 1', () => {
    const result = parsePagination({ page: '-2' });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });
});

describe('paginationMeta', () => {
  it('computes total pages', () => {
    expect(paginationMeta(45, 2, 20)).toEqual({
      total: 45,
      page: 2,
      limit: 20,
      totalPages: 3,
    });
  });

  it('returns at least 1 total page when empty', () => {
    expect(paginationMeta(0, 1, 20).totalPages).toBe(1);
  });
});
