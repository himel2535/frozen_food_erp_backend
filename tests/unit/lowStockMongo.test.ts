import { describe, expect, it } from 'vitest';
import {
  isQtyLowStock,
  productLowStockFilter,
  quantityMinStockLowStockFilter,
  rawMaterialLowStockFilter,
  resolveProductLowStockMin,
} from '../../src/utils/lowStockMongo.js';

function evalQtyVsMin(qty: number, min: number) {
  return isQtyLowStock(qty, min);
}

describe('isQtyLowStock', () => {
  it('requires positive on-hand and a positive threshold', () => {
    expect(evalQtyVsMin(0, 10)).toBe(false);
    expect(evalQtyVsMin(8, 0)).toBe(false);
    expect(evalQtyVsMin(8, 10)).toBe(true);
    expect(evalQtyVsMin(10, 10)).toBe(true);
    expect(evalQtyVsMin(12, 10)).toBe(false);
  });
});

describe('resolveProductLowStockMin', () => {
  it('prefers reorderLevel when set', () => {
    expect(resolveProductLowStockMin({ reorderLevel: 5, minStock: 20 })).toBe(5);
    expect(resolveProductLowStockMin({ reorderLevel: 0, minStock: 20 })).toBe(20);
  });
});

describe('mongo filter shape', () => {
  it('product filter uses stock vs reorder/minStock', () => {
    const filter = productLowStockFilter();
    const expr = JSON.stringify(filter);
    expect(filter.stock).toEqual({ $gt: 0 });
    expect(expr).toContain('$stock');
    expect(expr).toContain('$reorderLevel');
    expect(expr).toContain('$minStock');
  });

  it('raw material filter uses quantity vs threshold', () => {
    const filter = rawMaterialLowStockFilter();
    const expr = JSON.stringify(filter);
    expect(filter.quantity).toEqual({ $gt: 0 });
    expect(filter.threshold).toEqual({ $gt: 0 });
    expect(expr).toContain('$quantity');
    expect(expr).toContain('$threshold');
    expect(expr).not.toContain('$stock');
  });

  it('semi/finished filter uses quantity vs minStock', () => {
    const filter = quantityMinStockLowStockFilter();
    const expr = JSON.stringify(filter);
    expect(filter.quantity).toEqual({ $gt: 0 });
    expect(filter.minStock).toEqual({ $gt: 0 });
    expect(expr).toContain('$quantity');
    expect(expr).toContain('$minStock');
  });
});
