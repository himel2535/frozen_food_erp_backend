import { Invoice } from '../models/Invoice.js';
import { PosTransaction } from '../models/PosTransaction.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { clearResponseCache } from '../middleware/responseCache.js';

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
}

/** Keep SO / invoice / POS line names and photos in sync with the product master. */
export async function syncProductLineSnapshots(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const tenantId = String(next.tenantId ?? previous.tenantId ?? 'default');
  const nextName = String(next.name ?? '').trim();
  if (!nextName) return;

  const nextImage = String(next.imageUrl ?? '').trim();
  const nextSku = String(next.sku ?? next.legacyId ?? '').trim();
  const ids = uniqueStrings([
    next.legacyId,
    next.sku,
    next.id,
    next._id,
    previous.legacyId,
    previous.sku,
    previous.id,
    previous._id,
  ]);
  const oldName = String(previous.name ?? '').trim();

  const identityOr: Record<string, unknown>[] = [];
  if (ids.length) {
    identityOr.push({ 'items.sku': { $in: ids } }, { 'items.productId': { $in: ids } });
  }
  if (oldName) {
    identityOr.push({ 'items.name': oldName }, { 'items.description': oldName });
  }
  if (!identityOr.length) return;

  const elemOr: Record<string, unknown>[] = [];
  if (ids.length) {
    elemOr.push({ 'elem.sku': { $in: ids } }, { 'elem.productId': { $in: ids } });
  }
  if (oldName) {
    elemOr.push({ 'elem.name': oldName }, { 'elem.description': oldName });
  }

  const $set: Record<string, unknown> = {
    'items.$[elem].name': nextName,
    'items.$[elem].description': nextName,
    'items.$[elem].imageUrl': nextImage,
  };
  if (nextSku) {
    $set['items.$[elem].sku'] = nextSku;
    $set['items.$[elem].productId'] = nextSku;
  }

  const query = { tenantId, $or: identityOr };
  const options = { arrayFilters: [{ $or: elemOr }] };

  await Promise.all([
    SalesOrder.updateMany(query, { $set }, options),
    Invoice.updateMany(query, { $set }, options),
    PosTransaction.updateMany(query, { $set }, options),
  ]);

  clearResponseCache('/api/v1/sales-orders');
  clearResponseCache('/api/v1/invoices');
  clearResponseCache('/api/v1/pos-transactions');
}
