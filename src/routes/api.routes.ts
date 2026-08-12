import { Router } from 'express';
import { createCrudController } from '../controllers/crudFactory.js';
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
import {
  getSalesReport,
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
import { cacheGetResponse } from '../middleware/responseCache.js';

const DROPDOWN_CACHE_MS = 5 * 60 * 1000;
const REPORT_CACHE_MS = 60_000;

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
  resourceName: 'Customer',
  searchFields: ['legacyId', 'name', 'company', 'email', 'phone'],
  legacyIdPrefix: 'CUST',
});

const productCtrl = createCrudController(Product, {
  resourceName: 'Product',
  searchFields: ['legacyId', 'name', 'sku', 'category'],
  legacyIdPrefix: 'PROD',
  autoFields: { sku: 'SKU' },
});

const supplierCtrl = createCrudController(Supplier, {
  resourceName: 'Supplier',
  searchFields: ['legacyId', 'name', 'code', 'email', 'phone'],
  legacyIdPrefix: 'SUP',
});

const employeeCtrl = createCrudController(Employee, {
  resourceName: 'Employee',
  searchFields: ['legacyId', 'name', 'employeeCode', 'department', 'email'],
  legacyIdPrefix: 'EMP',
  autoFields: { employeeCode: 'EMP' },
});

const salesOrderCtrl = createCrudController(SalesOrder, {
  resourceName: 'Sales order',
  searchFields: ['legacyId', 'customer', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'SO',
});

const invoiceCtrl = createCrudController(Invoice, {
  resourceName: 'Invoice',
  searchFields: ['legacyId', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'INV',
});

const leadCtrl = createCrudController(Lead, {
  resourceName: 'Lead',
  searchFields: ['legacyId', 'name', 'company', 'email', 'phone'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'LEAD',
});

const dealCtrl = createCrudController(Deal, {
  resourceName: 'Deal',
  searchFields: ['legacyId', 'title', 'company'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'DEAL',
});

const quotationCtrl = createCrudController(Quotation, {
  resourceName: 'Quotation',
  searchFields: ['legacyId', 'customer', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'QUO',
});

const deliveryCtrl = createCrudController(Delivery, {
  resourceName: 'Delivery',
  searchFields: ['legacyId', 'customer', 'customerName', 'orderId'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'DC',
});

const dispatchCtrl = createCrudController(Dispatch, {
  resourceName: 'Dispatch',
  searchFields: ['legacyId', 'route', 'vehicle'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'DSP',
});

const paymentCtrl = createCrudController(Payment, {
  resourceName: 'Payment',
  searchFields: ['legacyId', 'customer', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'PAY',
});

const returnCtrl = createCrudController(SalesReturn, {
  resourceName: 'Return',
  searchFields: ['legacyId', 'customer', 'customerName', 'invoiceId'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'SR',
});

const complaintCtrl = createCrudController(Complaint, {
  resourceName: 'Complaint',
  searchFields: ['legacyId', 'subject', 'customerName', 'ticketNo'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'CMP',
  autoFields: { ticketNo: 'CMP' },
});

const posCtrl = createCrudController(PosTransaction, {
  resourceName: 'POS transaction',
  searchFields: ['legacyId', 'receiptNo', 'customerName'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'POS',
  autoFields: { receiptNo: 'POS' },
});

const categoryCtrl = createCrudController(Category, {
  resourceName: 'Category',
  searchFields: ['legacyId', 'name', 'code', 'type'],
  legacyIdPrefix: 'CAT',
  autoFields: { code: 'CAT' },
});

const unitCtrl = createCrudController(Unit, {
  resourceName: 'Unit',
  searchFields: ['legacyId', 'name', 'code', 'symbol'],
  legacyIdPrefix: 'UOM',
  autoFields: { code: 'UOM' },
});

const warehouseCtrl = createCrudController(Warehouse, {
  resourceName: 'Warehouse',
  searchFields: ['legacyId', 'name', 'location', 'manager'],
  legacyIdPrefix: 'WH',
});

const rawMaterialCtrl = createCrudController(RawMaterial, {
  resourceName: 'Raw material',
  searchFields: ['legacyId', 'name', 'category'],
  legacyIdPrefix: 'RM',
});

const semiFinishedCtrl = createCrudController(SemiFinishedProduct, {
  resourceName: 'Semi-finished product',
  searchFields: ['legacyId', 'name', 'category'],
  legacyIdPrefix: 'SF',
});

const finishedGoodCtrl = createCrudController(FinishedGood, {
  resourceName: 'Finished good',
  searchFields: ['legacyId', 'name', 'category'],
  legacyIdPrefix: 'FG',
});

const stockInCtrl = createCrudController(StockIn, {
  resourceName: 'Stock in',
  searchFields: ['legacyId', 'product', 'refDocId', 'supplier'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'SI',
});

const stockOutCtrl = createCrudController(StockOut, {
  resourceName: 'Stock out',
  searchFields: ['legacyId', 'product', 'refDocId'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'STO',
});

const stockTransferCtrl = createCrudController(StockTransfer, {
  resourceName: 'Stock transfer',
  searchFields: ['legacyId', 'product'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'ST',
});

const stockAdjustmentCtrl = createCrudController(StockAdjustment, {
  resourceName: 'Stock adjustment',
  searchFields: ['legacyId', 'product', 'reason'],
  defaultSort: { createdAt: -1 },
  legacyIdPrefix: 'ADJ',
});

export const apiRouter = Router();

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
      reports: {
        sales: '/api/v1/reports/sales',
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

apiRouter.get('/dashboard/summary', cacheGetResponse(60_000), getDashboardSummary);

apiRouter.get('/balance-sheet/summary', cacheGetResponse(REPORT_CACHE_MS), getBalanceSheetSummary);
apiRouter.get('/profit-loss/summary', cacheGetResponse(REPORT_CACHE_MS), getProfitLossSummary);
apiRouter.get('/trial-balance/summary', cacheGetResponse(REPORT_CACHE_MS), getTrialBalanceSummary);
apiRouter.get('/salary-sheet/summary', cacheGetResponse(REPORT_CACHE_MS), getSalarySheetSummary);

apiRouter.get('/reports/sales', cacheGetResponse(REPORT_CACHE_MS), getSalesReport);
apiRouter.get('/reports/purchases', cacheGetResponse(REPORT_CACHE_MS), getPurchaseReport);
apiRouter.get('/reports/inventory', cacheGetResponse(REPORT_CACHE_MS), getInventoryReport);
apiRouter.get('/reports/customers', cacheGetResponse(REPORT_CACHE_MS), getCustomerReport);
apiRouter.get('/reports/suppliers', cacheGetResponse(REPORT_CACHE_MS), getSupplierReport);
apiRouter.get('/reports/financial', cacheGetResponse(REPORT_CACHE_MS), getFinancialReport);
apiRouter.get('/reports/hr', cacheGetResponse(REPORT_CACHE_MS), getHrReport);

registerCrud(apiRouter, '/customers', customerCtrl);
registerCrud(apiRouter, '/products', productCtrl, { listCacheMs: DROPDOWN_CACHE_MS });
registerCrud(apiRouter, '/suppliers', supplierCtrl);
registerCrud(apiRouter, '/employees', employeeCtrl);
registerCrud(apiRouter, '/sales-orders', salesOrderCtrl);
registerCrud(apiRouter, '/invoices', invoiceCtrl);
registerCrud(apiRouter, '/leads', leadCtrl);
registerCrud(apiRouter, '/deals', dealCtrl);
registerCrud(apiRouter, '/quotations', quotationCtrl);
registerCrud(apiRouter, '/deliveries', deliveryCtrl);
registerCrud(apiRouter, '/dispatch', dispatchCtrl);
registerCrud(apiRouter, '/payments', paymentCtrl);
registerCrud(apiRouter, '/returns', returnCtrl);
registerCrud(apiRouter, '/complaints', complaintCtrl);
registerCrud(apiRouter, '/pos-transactions', posCtrl);
registerCrud(apiRouter, '/categories', categoryCtrl, { listCacheMs: DROPDOWN_CACHE_MS });
registerCrud(apiRouter, '/units', unitCtrl, { listCacheMs: DROPDOWN_CACHE_MS });
registerCrud(apiRouter, '/warehouses', warehouseCtrl, { listCacheMs: DROPDOWN_CACHE_MS });
registerCrud(apiRouter, '/raw-materials', rawMaterialCtrl);
registerCrud(apiRouter, '/semi-finished-products', semiFinishedCtrl);
registerCrud(apiRouter, '/finished-goods', finishedGoodCtrl);
registerCrud(apiRouter, '/stock-in', stockInCtrl);
registerCrud(apiRouter, '/stock-out', stockOutCtrl);
registerCrud(apiRouter, '/stock-transfers', stockTransferCtrl);
registerCrud(apiRouter, '/stock-adjustments', stockAdjustmentCtrl);

apiRouter.post('/stock-in/:id/approve', approveStockIn);
apiRouter.post('/stock-out/:id/complete', completeStockOut);
apiRouter.post('/stock-transfers/:id/complete', completeStockTransfer);
apiRouter.post('/stock-adjustments/:id/approve', approveStockAdjustment);

registerExtendedRoutes(apiRouter);
