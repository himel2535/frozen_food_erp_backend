import { Product } from '../models/Product.js';
import { PRODUCT_TOY_SKU_SEQUENCE_KEY, Sequence } from '../models/Sequence.js';

export function formatToySku(value: number): string {
  return `TOY-${String(Math.max(0, value)).padStart(6, '0')}`;
}

export async function aggregateMaxToySkuNumber(tenantId: string): Promise<number> {
  const [top] = await Product.aggregate<{ skuNum: number }>([
    { $match: { tenantId, sku: { $regex: /^TOY-\d+$/i } } },
    {
      $addFields: {
        skuNum: {
          $toInt: {
            $replaceAll: {
              input: { $toUpper: '$sku' },
              find: 'TOY-',
              replacement: '',
            },
          },
        },
      },
    },
    { $sort: { skuNum: -1 } },
    { $limit: 1 },
    { $project: { _id: 0, skuNum: 1 } },
  ]);

  return top?.skuNum ?? 0;
}

/** Atomically reserve the next TOY SKU for a tenant. */
export async function reserveNextProductSku(tenantId = 'default'): Promise<string> {
  const updated = await Sequence.findOneAndUpdate(
    { tenantId, key: PRODUCT_TOY_SKU_SEQUENCE_KEY },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (!updated) {
    throw new Error('Failed to reserve next product SKU');
  }

  if (Number(updated.value ?? 0) === 1) {
    const maxNum = await aggregateMaxToySkuNumber(tenantId);
    if (maxNum > 1) {
      const synced = await Sequence.findOneAndUpdate(
        { tenantId, key: PRODUCT_TOY_SKU_SEQUENCE_KEY },
        { $set: { value: maxNum + 1 } },
        { new: true },
      );
      return formatToySku(Number(synced?.value ?? maxNum + 1));
    }
  }

  return formatToySku(Number(updated.value ?? 0));
}
