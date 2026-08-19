import type { Request, Response } from 'express';
import {
  Customer,
  Invoice,
  Lead,
  Product,
  RawMaterial,
  SemiFinishedProduct,
  FinishedGood,
} from '../models/index.js';
import { PurchaseOrder, ProductionOrder, DueRecord } from '../models/extendedResources.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { serializeLeanDoc } from '../controllers/crudFactory.js';
import {
  productLowStockFilter,
  rawMaterialLowStockFilter,
  quantityMinStockLowStockFilter,
  resolveProductLowStockMin,
} from '../utils/lowStockMongo.js';
import { formatTimingLegs, timeNamed } from '../utils/timing.js';

type Priority = 'critical' | 'warning' | 'info';
type Category =
  | 'customer_due'
  | 'lead_followup'
  | 'low_stock'
  | 'pending_purchase'
  | 'production'
  | 'payment_collection'
  | 'supplier_due';

type AlertItem = {
  id: string;
  category: Category;
  priority: Priority;
  title: string;
  subtitle: string;
  lines: { label: string; value: string }[];
  href: string;
  actions: { label: string; href: string; variant?: 'primary' | 'outline' }[];
  sortKey: number;
  overdueDays?: number;
};

type Legs = Record<string, number>;

const ITEM_CAP = 50;
const OPEN_LEAD_STATUSES = ['won', 'lost', 'closed', 'Won', 'Lost', 'Closed'];
const PENDING_PO_STATUSES = ['Draft', 'Sent'];
const PRODUCTION_STATUSES = ['Planned', 'In Progress'];

function docId(doc: Record<string, unknown>) {
  const serialized = serializeLeanDoc(doc) as Record<string, unknown> & { id: string };
  return serialized.id || String(doc.legacyId ?? '');
}

function money(n: number) {
  return `৳ ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function dueValue(doc: Record<string, unknown>) {
  return Number(doc.totalDue ?? doc.due ?? doc.balance ?? 0);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string) {
  const a = Date.parse(`${fromIso.slice(0, 10)}T12:00:00`);
  const b = Date.parse(`${toIso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function highestPriority(items: AlertItem[]): Priority {
  if (items.some((i) => i.priority === 'critical')) return 'critical';
  if (items.some((i) => i.priority === 'warning')) return 'warning';
  return 'info';
}

function summarize(category: Category, count: number, items: AlertItem[]) {
  if (count <= 0) return null;
  return { category, count, priority: highestPriority(items) };
}

async function loadCustomerDue(tenantId: string, legs: Legs) {
  const filter = {
    tenantId,
    totalDue: { $gt: 0 },
  };
  const [count, docs] = await Promise.all([
    timeNamed('customerDueCount', () => Customer.countDocuments(filter), legs),
    timeNamed('customerDueItems', () =>
      Customer.find(filter).select('legacyId name company totalDue status').limit(ITEM_CAP).lean(),
      legs),
  ]);
  const items: AlertItem[] = (docs as Array<Record<string, unknown>>).map((doc) => {
    const due = dueValue(doc);
    const overdue = String(doc.status ?? '').toLowerCase() === 'overdue';
    const href = '/crm/customers';
    return {
      id: `customer-due-${docId(doc)}`,
      category: 'customer_due',
      priority: overdue || due >= 10_000 ? 'critical' : 'warning',
      title: String(doc.company || doc.name || 'Customer'),
      subtitle: 'Customer Due Follow-up',
      lines: [
        { label: 'Type', value: 'Customer Due Follow-up' },
        { label: 'Due Amount', value: money(due) },
        { label: 'Status', value: String(doc.status ?? 'due') },
        { label: 'Customer', value: String(doc.name ?? '—') },
      ],
      href,
      actions: [
        { label: 'Contact', href, variant: 'primary' },
        { label: 'Update Status', href, variant: 'outline' },
      ],
      sortKey: due,
    };
  });
  return { count, items };
}

async function loadLeadFollowups(tenantId: string, legs: Legs) {
  const filter = {
    tenantId,
    nextFollowUpAt: { $exists: true, $nin: [null, ''] },
    status: { $nin: OPEN_LEAD_STATUSES },
  };
  const [count, docs] = await Promise.all([
    timeNamed('leadFollowupCount', () => Lead.countDocuments(filter), legs),
    timeNamed('leadFollowupItems', () =>
      Lead.find(filter).select('legacyId name company status expectedValue nextFollowUpAt updatedAt createdAt').limit(ITEM_CAP).lean(),
      legs),
  ]);
  const today = todayIso();
  const items: AlertItem[] = (docs as Array<Record<string, unknown>>).map((doc) => {
    const followUp = String(doc.nextFollowUpAt ?? '').slice(0, 10);
    const daysUntil = followUp ? daysBetween(today, followUp) : 0;
    const href = '/crm/leads';
    return {
      id: `lead-${docId(doc)}`,
      category: 'lead_followup',
      priority: daysUntil < 0 ? 'critical' : daysUntil === 0 ? 'warning' : 'info',
      title: String(doc.company || doc.name || 'Lead'),
      subtitle: 'Lead Follow-up',
      lines: [
        { label: 'Type', value: 'Lead Follow-up' },
        { label: 'Status', value: String(doc.status ?? 'new') },
        { label: 'Next Follow', value: daysUntil === 0 ? 'Today' : followUp || '—' },
        { label: 'Value', value: money(Number(doc.expectedValue ?? 0)) },
      ],
      href,
      actions: [
        { label: 'Contact', href, variant: 'primary' },
        { label: 'Update Status', href, variant: 'outline' },
      ],
      sortKey: -daysUntil * 1000 + Number(doc.expectedValue ?? 0),
      overdueDays: daysUntil < 0 ? Math.abs(daysUntil) : undefined,
    };
  });
  return { count, items };
}

type StockSource = {
  typeLabel: string;
  href: string;
  qtyField: 'stock' | 'quantity';
  minField: 'minStock' | 'threshold' | 'reorderLevel';
  find: () => Promise<unknown[]>;
  count: () => Promise<number>;
};

async function loadLowStock(tenantId: string, legs: Legs) {
  const projection =
    'legacyId name sku category imageUrl stock quantity minStock reorderLevel threshold unit uom';
  const sources: StockSource[] = [
    {
      typeLabel: 'Product',
      href: '/inventory/products',
      qtyField: 'stock',
      minField: 'minStock',
      find: () => Product.find({ tenantId, ...productLowStockFilter() }).select(projection).limit(ITEM_CAP).lean(),
      count: () => Product.countDocuments({ tenantId, ...productLowStockFilter() }),
    },
    {
      typeLabel: 'Raw Material',
      href: '/inventory/raw-materials',
      qtyField: 'quantity',
      minField: 'threshold',
      find: () => RawMaterial.find({ tenantId, ...rawMaterialLowStockFilter() }).select(projection).limit(ITEM_CAP).lean(),
      count: () => RawMaterial.countDocuments({ tenantId, ...rawMaterialLowStockFilter() }),
    },
    {
      typeLabel: 'Semi Finished',
      href: '/inventory/semi-finished-products',
      qtyField: 'quantity',
      minField: 'minStock',
      find: () => SemiFinishedProduct.find({ tenantId, ...quantityMinStockLowStockFilter() }).select(projection).limit(ITEM_CAP).lean(),
      count: () => SemiFinishedProduct.countDocuments({ tenantId, ...quantityMinStockLowStockFilter() }),
    },
    {
      typeLabel: 'Finished Goods',
      href: '/inventory/finished-goods',
      qtyField: 'quantity',
      minField: 'minStock',
      find: () => FinishedGood.find({ tenantId, ...quantityMinStockLowStockFilter() }).select(projection).limit(ITEM_CAP).lean(),
      count: () => FinishedGood.countDocuments({ tenantId, ...quantityMinStockLowStockFilter() }),
    },
  ];

  const counts = await Promise.all(
    sources.map((source, i) => timeNamed(`lowStockCount${i}`, source.count, legs)),
  );
  const docs = await Promise.all(
    sources.map((source, i) => timeNamed(`lowStockItems${i}`, source.find, legs)),
  );

  const items: AlertItem[] = [];
  sources.forEach((source, i) => {
    for (const raw of docs[i] as Array<Record<string, unknown>>) {
      const qty = Number(raw[source.qtyField] ?? 0);
      const min = source.typeLabel === 'Product'
        ? resolveProductLowStockMin(raw)
        : Number(raw[source.minField] ?? 0);
      const need = Math.max(0, min - qty);
      items.push({
        id: `low-stock-${source.typeLabel}-${docId(raw)}`,
        category: 'low_stock',
        priority: qty <= 1 ? 'critical' : 'warning',
        title: String(raw.name ?? 'Item'),
        subtitle: 'Low Stock Alert',
        lines: [
          { label: 'Type', value: source.typeLabel },
          { label: 'Status', value: qty <= 0 ? 'Out of Stock' : 'Low Stock' },
          { label: 'Current Stock', value: `${qty} pcs` },
          { label: 'Need Purchase', value: `${need} pcs` },
        ],
        href: source.href,
        actions: [
          { label: 'Create Purchase Order', href: '/purchases/purchase-rm', variant: 'primary' },
          { label: 'View Details', href: source.href, variant: 'outline' },
        ],
        sortKey: need * 100 + (qty <= 1 ? 100_000 : 0),
      });
    }
  });

  items.sort((a, b) => b.sortKey - a.sortKey);
  return { count: counts.reduce((sum, n) => sum + n, 0), items: items.slice(0, ITEM_CAP) };
}

async function loadPendingPurchases(tenantId: string, legs: Legs) {
  const filter = { tenantId, status: { $in: PENDING_PO_STATUSES } };
  const [count, docs] = await Promise.all([
    timeNamed('pendingPurchaseCount', () => PurchaseOrder.countDocuments(filter), legs),
    timeNamed('pendingPurchaseItems', () =>
      PurchaseOrder.find(filter).limit(ITEM_CAP).lean(),
      legs),
  ]);
  const today = todayIso();
  const items: AlertItem[] = (docs as Array<Record<string, unknown>>).map((doc) => {
    const href = '/purchases/orders';
    const expected = String(doc.expectedDelivery ?? doc.date ?? '').slice(0, 10);
    return {
      id: `purchase-${docId(doc)}`,
      category: 'pending_purchase',
      priority: expected && daysBetween(today, expected) <= 1 ? 'warning' : 'info',
      title: String(doc.legacyId ?? doc.id ?? doc.reference ?? 'Purchase Order'),
      subtitle: 'Pending Purchase',
      lines: [
        { label: 'Type', value: 'Pending Purchase' },
        { label: 'Status', value: String(doc.status ?? 'Pending') },
        { label: 'Supplier', value: String(doc.supplierName ?? doc.supplier ?? 'Supplier') },
        { label: 'Expected Delivery', value: expected || '—' },
      ],
      href,
      actions: [
        { label: 'View Order', href, variant: 'primary' },
        { label: 'View Details', href, variant: 'outline' },
      ],
      sortKey: Number(doc.total ?? 0),
    };
  });
  return { count, items };
}

async function loadProduction(tenantId: string, legs: Legs) {
  const filter = { tenantId, status: { $in: PRODUCTION_STATUSES } };
  const [count, docs] = await Promise.all([
    timeNamed('productionCount', () => ProductionOrder.countDocuments(filter), legs),
    timeNamed('productionItems', () => ProductionOrder.find(filter).limit(ITEM_CAP).lean(), legs),
  ]);
  const items: AlertItem[] = (docs as Array<Record<string, unknown>>).map((doc) => {
    const href = '/manufacturing/wastage';
    const status = String(doc.status ?? 'Planned');
    return {
      id: `production-${docId(doc)}`,
      category: 'production',
      priority: status.toLowerCase() === 'in progress' ? 'warning' : 'info',
      title: `Production Order #${String(doc.legacyId ?? docId(doc)).replace(/^PROD-/, '')}`,
      subtitle: 'Production Alert',
      lines: [
        { label: 'Type', value: 'Production Alert' },
        { label: 'Status', value: status },
        { label: 'Product', value: String(doc.product ?? doc.productName ?? '—') },
        { label: 'Qty', value: String(doc.plannedQuantity ?? doc.qty ?? 0) },
      ],
      href,
      actions: [
        { label: 'View BOM', href: '/purchases/recipes/finished-goods', variant: 'primary' },
        { label: 'View Production', href, variant: 'outline' },
      ],
      sortKey: Number(doc.plannedQuantity ?? doc.qty ?? 0),
    };
  });
  return { count, items };
}

async function loadPaymentsDueToday(tenantId: string, legs: Legs) {
  const today = todayIso();
  const invoiceFilter = {
    tenantId,
    due: { $gt: 0 },
    status: { $nin: ['paid', 'cancelled'] },
    $or: [{ dueDate: today }, { dueDate: { $regex: `^${today}` } }],
  };
  const dueFilter = {
    tenantId,
    status: { $in: ['due_today', 'Due Today'] },
  };
  const [invoiceCount, invoices, dueCount, dues] = await Promise.all([
    timeNamed('payTodayInvCount', () => Invoice.countDocuments(invoiceFilter), legs),
    timeNamed('payTodayInvItems', () =>
      Invoice.find(invoiceFilter).select('legacyId customerId customerName due dueDate status').limit(ITEM_CAP).lean(),
      legs),
    timeNamed('payTodayDueCount', () => DueRecord.countDocuments(dueFilter), legs),
    timeNamed('payTodayDueItems', () => DueRecord.find(dueFilter).limit(ITEM_CAP).lean(), legs),
  ]);

  const items: AlertItem[] = [];
  for (const doc of invoices as Array<Record<string, unknown>>) {
    const href = '/accounting/receivables';
    items.push({
      id: `pay-inv-${docId(doc)}`,
      category: 'payment_collection',
      priority: 'warning',
      title: String(doc.customerName ?? 'Customer'),
      subtitle: 'Payment Reminder',
      lines: [
        { label: 'Type', value: 'Payment Due Today' },
        { label: 'Invoice', value: String(doc.legacyId ?? docId(doc)) },
        { label: 'Due Amount', value: money(Number(doc.due ?? 0)) },
        { label: 'Due Date', value: today },
      ],
      href,
      actions: [
        { label: 'Collect', href, variant: 'primary' },
        { label: 'View Details', href, variant: 'outline' },
      ],
      sortKey: Number(doc.due ?? 0),
    });
  }
  for (const doc of dues as Array<Record<string, unknown>>) {
    if (String(doc.type ?? doc.partyType ?? 'customer').toLowerCase().includes('supplier')) continue;
    const href = '/accounting/dues';
    items.push({
      id: `pay-due-${docId(doc)}`,
      category: 'payment_collection',
      priority: 'warning',
      title: String(doc.partyName ?? doc.customerName ?? 'Customer'),
      subtitle: 'Payment Reminder',
      lines: [
        { label: 'Type', value: 'Payment Due Today' },
        { label: 'Due Amount', value: money(dueValue(doc)) },
        { label: 'Status', value: 'Due Today' },
        { label: 'Party', value: String(doc.partyName ?? '—') },
      ],
      href,
      actions: [
        { label: 'Collect', href, variant: 'primary' },
        { label: 'View Details', href, variant: 'outline' },
      ],
      sortKey: dueValue(doc),
    });
  }
  return { count: invoiceCount + dueCount, items: items.slice(0, ITEM_CAP) };
}

async function loadSupplierDue(tenantId: string, legs: Legs) {
  const filter = {
    tenantId,
    $or: [
      { due: { $gt: 0 } },
      { due: { $exists: false }, balance: { $gt: 0 } },
      { due: null, balance: { $gt: 0 } }
    ]
  };
  const [count, docs] = await Promise.all([
    timeNamed('supplierDueCount', () => PurchaseOrder.countDocuments(filter), legs),
    timeNamed('supplierDueItems', () => PurchaseOrder.find(filter).limit(ITEM_CAP).lean(), legs),
  ]);
  const items: AlertItem[] = (docs as Array<Record<string, unknown>>).map((doc) => {
    const due = dueValue(doc);
    const href = '/purchases/payments';
    return {
      id: `supplier-due-${docId(doc)}`,
      category: 'supplier_due',
      priority: due >= 10_000 ? 'critical' : 'warning',
      title: String(doc.supplierName ?? doc.supplier ?? 'Supplier'),
      subtitle: 'Supplier Payment Due',
      lines: [
        { label: 'Type', value: 'Supplier Payment Due' },
        { label: 'Order', value: String(doc.legacyId ?? docId(doc)) },
        { label: 'Due Amount', value: money(due) },
        { label: 'Status', value: String(doc.paymentStatus ?? doc.status ?? 'unpaid') },
      ],
      href,
      actions: [
        { label: 'Pay', href, variant: 'primary' },
        { label: 'View Details', href, variant: 'outline' },
      ],
      sortKey: due,
    };
  });
  return { count, items };
}

export const getDashboardBusinessAlerts = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenantId ?? 'default');
  const started = Date.now();
  const legs: Legs = {};

  const [customerDue, leads, lowStock, purchases, production, payments, supplierDue] = await Promise.all([
    loadCustomerDue(tenantId, legs),
    loadLeadFollowups(tenantId, legs),
    loadLowStock(tenantId, legs),
    loadPendingPurchases(tenantId, legs),
    loadProduction(tenantId, legs),
    loadPaymentsDueToday(tenantId, legs),
    loadSupplierDue(tenantId, legs),
  ]);

  const buckets = [
    { category: 'customer_due' as const, ...customerDue },
    { category: 'lead_followup' as const, ...leads },
    { category: 'low_stock' as const, ...lowStock },
    { category: 'pending_purchase' as const, ...purchases },
    { category: 'production' as const, ...production },
    { category: 'payment_collection' as const, ...payments },
    { category: 'supplier_due' as const, ...supplierDue },
  ];

  const summaries = buckets
    .map((bucket) => summarize(bucket.category, bucket.count, bucket.items))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const items = buckets.flatMap((bucket) => bucket.items);

  console.log(`[timing] GET /dashboard/business-alerts ${formatTimingLegs(legs)} total=${Date.now() - started}ms`);
  sendSuccess(res, { summaries, items });
});
