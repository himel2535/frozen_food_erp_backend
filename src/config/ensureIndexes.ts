import mongoose from 'mongoose';

const TENANT_STATUS = { tenantId: 1 as const, status: 1 as const };
const TENANT_CREATED = { tenantId: 1 as const, createdAt: -1 as const };
const TENANT_DATE = { tenantId: 1 as const, date: -1 as const };
const TENANT_CUSTOMER = { tenantId: 1 as const, customerId: 1 as const };
const TENANT_LEGACY = { tenantId: 1 as const, legacyId: 1 as const };
const TENANT_FOLLOWUP = { tenantId: 1 as const, nextFollowUpAt: 1 as const };

type IndexSpec = Record<string, 1 | -1>;

/** Compound indexes for list/filter queries — safe to call on every boot. */
export async function ensureDatabaseIndexes(): Promise<void> {
  const { models } = mongoose;
  const tasks: Promise<string>[] = [];

  const withIndexes = (name: string, indexes: IndexSpec[]) => {
    const model = models[name];
    if (!model) return;
    for (const spec of indexes) {
      tasks.push(model.collection.createIndex(spec).then(() => `${name}:${JSON.stringify(spec)}`));
    }
  };

  const listModels = [
    'Customer', 'Product', 'Supplier', 'Employee', 'SalesOrder', 'Invoice', 'Lead', 'Deal',
    'Quotation', 'Delivery', 'Dispatch', 'Payment', 'Return', 'Complaint', 'PosTransaction',
    'Category', 'Unit', 'Warehouse', 'RawMaterial', 'SemiFinishedProduct', 'FinishedGood',
    'StockIn', 'StockOut', 'StockTransfer', 'StockAdjustment',
    'PurchaseOrder', 'ProductionOrder', 'Project', 'Department', 'Designation', 'LeaveRequest',
    'Attendance', 'PayrollRun', 'SalaryStructure', 'Asset', 'Recipe', 'GoodsReceived',
    'PurchaseBill', 'PurchasePayment', 'PurchaseReturn', 'Journal', 'LedgerEntry', 'CashboxEntry',
  ];

  for (const name of listModels) {
    withIndexes(name, [TENANT_STATUS, TENANT_CREATED, TENANT_LEGACY]);
  }

  withIndexes('Invoice', [TENANT_DATE, TENANT_CUSTOMER]);
  withIndexes('SalesOrder', [TENANT_DATE]);
  withIndexes('Payment', [TENANT_DATE]);
  withIndexes('Lead', [TENANT_FOLLOWUP]);

  await Promise.allSettled(tasks);
  console.log(`[db] Ensured ${tasks.length} compound indexes`);
}
