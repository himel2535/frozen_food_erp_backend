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

async function ensureProductToySkuSequence(tenantId: string): Promise<void> {
  const existing = await Sequence.findOne({ tenantId, key: PRODUCT_TOY_SKU_SEQUENCE_KEY }).lean();
  if (existing) return;

  const maxNum = await aggregateMaxToySkuNumber(tenantId);
  try {
    await Sequence.create({ tenantId, key: PRODUCT_TOY_SKU_SEQUENCE_KEY, value: maxNum });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 11000) throw err;
  }
}

/** Atomically reserve the next TOY SKU for a tenant. */
export async function reserveNextProductSku(tenantId = 'default'): Promise<string> {
  await ensureProductToySkuSequence(tenantId);

  const updated = await Sequence.findOneAndUpdate(
    { tenantId, key: PRODUCT_TOY_SKU_SEQUENCE_KEY },
    { $inc: { value: 1 } },
    { new: true },
  );

  if (!updated) {
    throw new Error('Failed to reserve next product SKU');
  }

  return formatToySku(Number(updated.value ?? 0));
}
