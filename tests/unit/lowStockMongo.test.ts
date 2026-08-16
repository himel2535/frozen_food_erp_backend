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
    const expr = JSON.stringify(productLowStockFilter());
    expect(expr).toContain('$stock');
    expect(expr).toContain('$reorderLevel');
    expect(expr).toContain('$minStock');
  });

  it('raw material filter uses quantity vs threshold', () => {
    const expr = JSON.stringify(rawMaterialLowStockFilter());
    expect(expr).toContain('$quantity');
    expect(expr).toContain('$threshold');
    expect(expr).not.toContain('$stock');
  });

  it('semi/finished filter uses quantity vs minStock', () => {
    const expr = JSON.stringify(quantityMinStockLowStockFilter());
    expect(expr).toContain('$quantity');
    expect(expr).toContain('$minStock');
  });
});
