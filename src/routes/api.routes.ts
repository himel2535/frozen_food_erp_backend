import { Router } from 'express';
import { createCrudController } from '../controllers/crudFactory.js';
import { syncProductLineSnapshots } from '../utils/syncProductLineSnapshots.js';
import {
  approveStockAdjustment,
  approveStockIn,
  completeStockOut,
  completeStockTransfer,
} from '../controllers/inventoryStockController.js';
import {
  Customer,
  Product,
  Supplier,
  Employee,
  SalesOrder,
  Invoice,
  Lead,
  Deal,
  Quotation,
  Delivery,
  Dispatch,
  Payment,
  SalesReturn,
  Complaint,
  PosTransaction,
  Category,
  Unit,
  Warehouse,
  RawMaterial,
  SemiFinishedProduct,
  FinishedGood,
  StockIn,
  StockOut,
  StockTransfer,
  StockAdjustment,
} from '../models/index.js';
import { registerExtendedRoutes, EXTENDED_API_ENDPOINTS } from './extendedRoutes.js';
import { getDashboardSummary } from '../controllers/dashboardController.js';
import { listLowStockAlerts } from '../controllers/lowStockAlertsController.js';
import {
  getSalesReport,
  getProductSalesReport,
  getPurchaseReport,
  getInventoryReport,
  getCustomerReport,
  getSupplierReport,
  getFinancialReport,
  getHrReport,
} from '../controllers/reportsController.js';
import {
  getBalanceSheetSummary,
  getProfitLossSummary,
  getTrialBalanceSummary,
} from '../controllers/accountingController.js';
import { getSalarySheetSummary } from '../controllers/payrollController.js';
import { listNotifications } from '../controllers/notificationController.js';
import { cacheGetResponse, dashboardSummaryCacheKey } from '../middleware/responseCache.js';
import { requireInventoryEdit } from '../middleware/requireInventoryEdit.js';
import { createAndEmitNotification } from '../services/notify.js';
import { getNextProductSku } from '../controllers/productSkuController.js';

const REPORT_CACHE_MS = 60_000;

export const apiRouter = Router();

apiRouter.use(requireInventoryEdit);

function registerCrud(
  router: Router,
  path: string,
  ctrl: ReturnType<typeof createCrudController>,
  options?: { listCacheMs?: number },
) {
  const listChain = options?.listCacheMs
    ? [cacheGetResponse(options.listCacheMs), ctrl.list]
    : [ctrl.list];
  router.get(path, ...listChain);
  router.post(`${path}/seed`, ctrl.bulkSeed);
  router.get(`${path}/:id`, ctrl.getById);
  router.post(path, ctrl.create);
  router.put(`${path}/:id`, ctrl.update);
  router.patch(`${path}/:id`, ctrl.update);
  router.delete(`${path}/:id`, ctrl.remove);
}

const customerCtrl = createCrudController(Customer, {
  listCachePrefix: '/api/v1/customers',
  resourceName: 'Customer',
  searchFields: ['legacyId', 'name', 'company', 'email', 'phone'],
  legacyIdPrefix: 'CUST',
});

const productCtrl = createCrudController(Product, {
  listCachePrefix: '/api/v1/products',
  resourceName: 'Product',
  searchFields: ['legacyId', 'name', 'sku', 'category'],
  legacyIdPrefix: 'PROD',
  autoFields: { sku: 'SKU' },
  stockDurationQtyField: 'stock',
  onUpdated: (previous, next) => {
    void syncProductLineSnapshots(previous, next).catch((err) => {
      console.error('[Product] syncProductLineSnapshots failed', err);
    });
  },
});

const supplierCtrl = createCrudController(Supplier, {
  listCachePrefix: '/api/v1/suppliers',
  resourceName: 'Supplier',
  searchFields: ['legacyId', 'name', 'code', 'email', 'phone'],
  legacyIdPrefix: 'SUP',
});

const employeeCtrl = createCrudController(Employee, {
  listCachePrefix: '/api/v1/employees',
  resourceName: 'Employee',
  searchFields: ['legacyId', 'name', 'employeeCode', 'department', 'email'],
  legacyIdPrefix: 'EMP',
  autoFields: { employeeCode: 'EMP' },
});

const salesOrderCtrl = createCrudController(SalesOrder, {
  listCachePrefix: '/api/v1/sales-orders',
  resourceName: 'Sales order',
  searchFields: ['legacyId', 'customer', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'SO',
  onCreated: async (doc) => {
    const json = doc.toJSON();
    const legacyId = String(json.legacyId ?? json.id ?? doc._id ?? '');
    await createAndEmitNotification({
      tenantId: String(json.tenantId ?? doc.tenantId ?? 'default'),
      type: 'sales_order',
      message: `New sales order ${legacyId} created`,
      refId: String(doc._id),
    });
  },
});

const invoiceCtrl = createCrudController(Invoice, {
  listCachePrefix: '/api/v1/invoices',
  resourceName: 'Invoice',
  searchFields: ['legacyId', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'INV',
});

const leadCtrl = createCrudController(Lead, {
  listCachePrefix: '/api/v1/leads',
  resourceName: 'Lead',
  searchFields: ['legacyId', 'name', 'company', 'email', 'phone'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'LEAD',
});

const dealCtrl = createCrudController(Deal, {
  listCachePrefix: '/api/v1/deals',
  resourceName: 'Deal',
  searchFields: ['legacyId', 'title', 'company'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'DEAL',
});

const quotationCtrl = createCrudController(Quotation, {
  listCachePrefix: '/api/v1/quotations',
  resourceName: 'Quotation',
  searchFields: ['legacyId', 'customer', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'QUO',
});

const deliveryCtrl = createCrudController(Delivery, {
  listCachePrefix: '/api/v1/deliveries',
  resourceName: 'Delivery',
  searchFields: ['legacyId', 'customer', 'customerName', 'orderId'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'DC',
});

const dispatchCtrl = createCrudController(Dispatch, {
  listCachePrefix: '/api/v1/dispatch',
  resourceName: 'Dispatch',
  searchFields: ['legacyId', 'route', 'vehicle'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'DSP',
});

const paymentCtrl = createCrudController(Payment, {
  listCachePrefix: '/api/v1/payments',
  resourceName: 'Payment',
  searchFields: ['legacyId', 'customer', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'PAY',
});

const returnCtrl = createCrudController(SalesReturn, {
  listCachePrefix: '/api/v1/returns',
  resourceName: 'Return',
  searchFields: ['legacyId', 'customer', 'customerName', 'invoiceId'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'SR',
});

const complaintCtrl = createCrudController(Complaint, {
  listCachePrefix: '/api/v1/complaints',
  resourceName: 'Complaint',
  searchFields: ['legacyId', 'subject', 'customerName', 'ticketNo'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'CMP',
  autoFields: { ticketNo: 'CMP' },
});

const posCtrl = createCrudController(PosTransaction, {
  listCachePrefix: '/api/v1/pos-transactions',
  resourceName: 'POS transaction',
  searchFields: ['legacyId', 'receiptNo', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'POS',
  autoFields: { receiptNo: 'POS' },
});

const categoryCtrl = createCrudController(Category, {
  listCachePrefix: '/api/v1/categories',
  resourceName: 'Category',
  searchFields: ['legacyId', 'name', 'code', 'type'],
  legacyIdPrefix: 'CAT',
  autoFields: { code: 'CAT' },
});

const unitCtrl = createCrudController(Unit, {
  listCachePrefix: '/api/v1/units',
  resourceName: 'Unit',
  searchFields: ['legacyId', 'name', 'code', 'symbol'],
  legacyIdPrefix: 'UOM',
  autoFields: { code: 'UOM' },
});

const warehouseCtrl = createCrudController(Warehouse, {
  listCachePrefix: '/api/v1/warehouses',
  resourceName: 'Warehouse',
  searchFields: ['legacyId', 'name', 'location', 'manager'],
  legacyIdPrefix: 'WH',
});

const rawMaterialCtrl = createCrudController(RawMaterial, {
  listCachePrefix: '/api/v1/raw-materials',
  resourceName: 'Raw material',
  searchFields: ['legacyId', 'name', 'category'],
  legacyIdPrefix: 'RM',
  stockDurationQtyField: 'quantity',
});

const semiFinishedCtrl = createCrudController(SemiFinishedProduct, {
  listCachePrefix: '/api/v1/semi-finished-products',
  resourceName: 'Semi-finished product',
  searchFields: ['legacyId', 'name', 'category'],
  legacyIdPrefix: 'SF',
});

const finishedGoodCtrl = createCrudController(FinishedGood, {
  listCachePrefix: '/api/v1/finished-goods',
  resourceName: 'Finished good',
  searchFields: ['legacyId', 'name', 'category'],
  legacyIdPrefix: 'FG',
});

const stockInCtrl = createCrudController(StockIn, {
  listCachePrefix: '/api/v1/stock-in',
  resourceName: 'Stock in',
  searchFields: ['legacyId', 'product', 'refDocId', 'supplier'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'SI',
});

const stockOutCtrl = createCrudController(StockOut, {
  listCachePrefix: '/api/v1/stock-out',
  resourceName: 'Stock out',
  searchFields: ['legacyId', 'product', 'refDocId'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'STO',
});

const stockTransferCtrl = createCrudController(StockTransfer, {
  listCachePrefix: '/api/v1/stock-transfers',
  resourceName: 'Stock transfer',
  searchFields: ['legacyId', 'product'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'ST',
});

const stockAdjustmentCtrl = createCrudController(StockAdjustment, {
  listCachePrefix: '/api/v1/stock-adjustments',
  resourceName: 'Stock adjustment',
  searchFields: ['legacyId', 'product', 'reason'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'ADJ',
});

apiRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Toys Factory ERP API v1',
    endpoints: {
      customers: '/api/v1/customers',
      products: '/api/v1/products',
      suppliers: '/api/v1/suppliers',
      employees: '/api/v1/employees',
      salesOrders: '/api/v1/sales-orders',
      invoices: '/api/v1/invoices',
      leads: '/api/v1/leads',
      deals: '/api/v1/deals',
      quotations: '/api/v1/quotations',
      deliveries: '/api/v1/deliveries',
      dispatch: '/api/v1/dispatch',
      payments: '/api/v1/payments',
      returns: '/api/v1/returns',
      complaints: '/api/v1/complaints',
      posTransactions: '/api/v1/pos-transactions',
      categories: '/api/v1/categories',
      units: '/api/v1/units',
      warehouses: '/api/v1/warehouses',
      rawMaterials: '/api/v1/raw-materials',
      semiFinishedProducts: '/api/v1/semi-finished-products',
      finishedGoods: '/api/v1/finished-goods',
      stockIn: '/api/v1/stock-in',
      stockOut: '/api/v1/stock-out',
      stockTransfers: '/api/v1/stock-transfers',
      stockAdjustments: '/api/v1/stock-adjustments',
      dashboardSummary: '/api/v1/dashboard/summary',
      lowStockAlerts: '/api/v1/inventory/low-stock-alerts',
      notifications: '/api/v1/notifications',
      reports: {
        sales: '/api/v1/reports/sales',
        productSales: '/api/v1/reports/product-sales',
        purchases: '/api/v1/reports/purchases',
        inventory: '/api/v1/reports/inventory',
        customers: '/api/v1/reports/customers',
        suppliers: '/api/v1/reports/suppliers',
        financial: '/api/v1/reports/financial',
        hr: '/api/v1/reports/hr',
      },
      ...Object.fromEntries(
        Object.entries(EXTENDED_API_ENDPOINTS).map(([k, v]) => [k, `/api/v1${v}`]),
      ),
    },
    seed: 'POST /api/v1/{resource}/seed — bulk sample data',
    health: '/health',
  });
});

apiRouter.get('/dashboard/summary', cacheGetResponse(60_000, dashboardSummaryCacheKey), getDashboardSummary);
apiRouter.get('/inventory/low-stock-alerts', listLowStockAlerts);
apiRouter.get('/notifications', listNotifications);

apiRouter.get('/balance-sheet/summary', cacheGetResponse(REPORT_CACHE_MS), getBalanceSheetSummary);
apiRouter.get('/profit-loss/summary', cacheGetResponse(REPORT_CACHE_MS), getProfitLossSummary);
apiRouter.get('/trial-balance/summary', cacheGetResponse(REPORT_CACHE_MS), getTrialBalanceSummary);
apiRouter.get('/salary-sheet/summary', cacheGetResponse(REPORT_CACHE_MS), getSalarySheetSummary);

apiRouter.get('/reports/sales', cacheGetResponse(REPORT_CACHE_MS), getSalesReport);
apiRouter.get('/reports/product-sales', cacheGetResponse(REPORT_CACHE_MS), getProductSalesReport);
apiRouter.get('/reports/purchases', cacheGetResponse(REPORT_CACHE_MS), getPurchaseReport);
apiRouter.get('/reports/inventory', cacheGetResponse(REPORT_CACHE_MS), getInventoryReport);
apiRouter.get('/reports/customers', cacheGetResponse(REPORT_CACHE_MS), getCustomerReport);
apiRouter.get('/reports/suppliers', cacheGetResponse(REPORT_CACHE_MS), getSupplierReport);
apiRouter.get('/reports/financial', cacheGetResponse(REPORT_CACHE_MS), getFinancialReport);
apiRouter.get('/reports/hr', cacheGetResponse(REPORT_CACHE_MS), getHrReport);

registerCrud(apiRouter, '/customers', customerCtrl, { listCacheMs: 30000 });
apiRouter.get('/products/next-sku', getNextProductSku);
registerCrud(apiRouter, '/products', productCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/suppliers', supplierCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/employees', employeeCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/sales-orders', salesOrderCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/invoices', invoiceCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/leads', leadCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/deals', dealCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/quotations', quotationCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/deliveries', deliveryCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/dispatch', dispatchCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/payments', paymentCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/returns', returnCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/complaints', complaintCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/pos-transactions', posCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/categories', categoryCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/units', unitCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/warehouses', warehouseCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/raw-materials', rawMaterialCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/semi-finished-products', semiFinishedCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/finished-goods', finishedGoodCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/stock-in', stockInCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/stock-out', stockOutCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/stock-transfers', stockTransferCtrl, { listCacheMs: 30000 });
registerCrud(apiRouter, '/stock-adjustments', stockAdjustmentCtrl, { listCacheMs: 30000 });

apiRouter.post('/stock-in/:id/approve', approveStockIn);
apiRouter.post('/stock-out/:id/complete', completeStockOut);
apiRouter.post('/stock-transfers/:id/complete', completeStockTransfer);
apiRouter.post('/stock-adjustments/:id/approve', approveStockAdjustment);

registerExtendedRoutes(apiRouter);
