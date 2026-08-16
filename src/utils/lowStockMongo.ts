/** On-hand still positive, at or below a positive min/reorder/threshold. */

export function isQtyLowStock(qty: number, min: number): boolean {
  return qty > 0 && min > 0 && qty <= min;
}

function qtyVsMinExpr(qtyPath: string, minExpr: unknown) {
  return {
    $expr: {
      $and: [
        { $gt: [{ $ifNull: [qtyPath, 0] }, 0] },
        { $gt: [minExpr, 0] },
        { $lte: [{ $ifNull: [qtyPath, 0] }, minExpr] },
      ],
    },
  };
}

/** Product: reorderLevel if set, otherwise minStock. */
export function productLowStockFilter() {
  const threshold = {
    $cond: [
      { $gt: [{ $ifNull: ['$reorderLevel', 0] }, 0] },
      { $ifNull: ['$reorderLevel', 0] },
      { $ifNull: ['$minStock', 0] },
    ],
  };
  return qtyVsMinExpr('$stock', threshold);
}

/** Raw material: quantity vs threshold (0 = alerts off). */
export function rawMaterialLowStockFilter() {
  return qtyVsMinExpr('$quantity', { $ifNull: ['$threshold', 0] });
}

/** Semi-finished / finished goods: quantity vs minStock. */
export function quantityMinStockLowStockFilter() {
  return qtyVsMinExpr('$quantity', { $ifNull: ['$minStock', 0] });
}

export function resolveProductLowStockMin(row: Record<string, unknown>): number {
  const reorder = Number(row.reorderLevel ?? 0);
  if (reorder > 0) return reorder;
  return Number(row.minStock ?? 0);
}
