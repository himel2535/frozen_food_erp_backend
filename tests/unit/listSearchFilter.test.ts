import { describe, expect, it } from 'vitest';
import { buildListSearchFilter } from '../../src/controllers/crudFactory.js';

const PRODUCT_FIELDS = ['legacyId', 'name', 'sku', 'category'];

function matchesName(search: string, name: string) {
  const filter = buildListSearchFilter(search, PRODUCT_FIELDS);
  expect(filter).not.toBeNull();
  const clauses = (filter as { $or: Array<Record<string, RegExp>> }).$or;
  const nameRegex = clauses.find((clause) => clause.name)?.name;
  expect(nameRegex).toBeInstanceOf(RegExp);
  return nameRegex.test(name);
}

describe('buildListSearchFilter', () => {
  it('matches a short substring against a product name', () => {
    expect(matchesName('dd', 'ddd')).toBe(true);
    expect(matchesName('dd', 'doll')).toBe(false);
    expect(matchesName('dol', 'doll')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesName('HELI', 'helicopter toy')).toBe(true);
  });

  it('escapes regex metacharacters', () => {
    const filter = buildListSearchFilter('a.b', ['name']);
    const regex = (filter as { $or: Array<Record<string, RegExp>> }).$or[0].name;
    expect(regex.test('a.b')).toBe(true);
    expect(regex.test('axb')).toBe(false);
  });

  it('returns null for empty search or fields', () => {
    expect(buildListSearchFilter('  ', PRODUCT_FIELDS)).toBeNull();
    expect(buildListSearchFilter('dd', [])).toBeNull();
  });
});
