import type { Router } from 'express';
import { createCrudController } from '../controllers/crudFactory.js';
import {
  PurchaseOrder,
  GoodsReceived,
  VendorBill,
  PurchasePayment,
  PurchaseReturn,
  Recipe,
  PurchaseRm,
  Department,
  Designation,
  Attendance,
  LeaveRequest,
  SalaryStructure,
  PayrollRun,
  PayrollSlip,
  ProductionOrder,
  MachineMaintenance,
  Mold,
  Wastage,
  Packing,
  Journal,
  LedgerEntry,
  DueRecord,
  CrmActivity,
  WholesaleOrder,
  AppUser,
  AppRole,
  AppPermission,
  AppDocument,
  CompanySetting,
  Project,
  Asset,
  WorkflowApproval,
  AuditLog,
  Notification,
  CashboxEntry,
  TrialBalanceLine,
  ProfitLossLine,
  BalanceSheetLine,
  SalarySheetEntry,
} from '../models/extendedResources.js';

function registerCrud(router: Router, path: string, ctrl: ReturnType<typeof createCrudController>) {
  router.get(path, ctrl.list);
  router.post(`${path}/seed`, ctrl.bulkSeed);
  router.get(`${path}/:id`, ctrl.getById);
  router.post(path, ctrl.create);
  router.put(`${path}/:id`, ctrl.update);
  router.patch(`${path}/:id`, ctrl.update);
  router.delete(`${path}/:id`, ctrl.remove);
}

type ResourceDef = {
  path: string;
  model: Parameters<typeof createCrudController>[0];
  resourceName: string;
  searchFields: string[];
  legacyIdPrefix: string;
};

const EXTENDED_RESOURCES: ResourceDef[] = [
  { path: '/purchase-orders', model: PurchaseOrder, resourceName: 'Purchase order', searchFields: ['legacyId', 'supplier', 'product', 'name'], legacyIdPrefix: 'PO' },
  { path: '/goods-received', model: GoodsReceived, resourceName: 'Goods received', searchFields: ['legacyId', 'supplier', 'product'], legacyIdPrefix: 'GRN' },
  { path: '/vendor-bills', model: VendorBill, resourceName: 'Vendor bill', searchFields: ['legacyId', 'supplier'], legacyIdPrefix: 'BILL' },
  { path: '/purchase-payments', model: PurchasePayment, resourceName: 'Purchase payment', searchFields: ['legacyId', 'supplier'], legacyIdPrefix: 'PPAY' },
  { path: '/purchase-returns', model: PurchaseReturn, resourceName: 'Purchase return', searchFields: ['legacyId', 'supplier'], legacyIdPrefix: 'PRET' },
  { path: '/recipes', model: Recipe, resourceName: 'Recipe', searchFields: ['legacyId', 'name', 'product'], legacyIdPrefix: 'REC' },
  { path: '/purchase-rm', model: PurchaseRm, resourceName: 'Purchase RM', searchFields: ['legacyId', 'supplier', 'material'], legacyIdPrefix: 'PRM' },
  { path: '/departments', model: Department, resourceName: 'Department', searchFields: ['legacyId', 'name', 'head'], legacyIdPrefix: 'DEPT' },
  { path: '/designations', model: Designation, resourceName: 'Designation', searchFields: ['legacyId', 'title', 'department'], legacyIdPrefix: 'DES' },
  { path: '/attendance', model: Attendance, resourceName: 'Attendance', searchFields: ['legacyId', 'employeeId', 'date'], legacyIdPrefix: 'ATT' },
  { path: '/leave-requests', model: LeaveRequest, resourceName: 'Leave request', searchFields: ['legacyId', 'employee', 'type'], legacyIdPrefix: 'LV' },
  { path: '/salary-structures', model: SalaryStructure, resourceName: 'Salary structure', searchFields: ['legacyId', 'name', 'code'], legacyIdPrefix: 'SS' },
  { path: '/payroll-runs', model: PayrollRun, resourceName: 'Payroll run', searchFields: ['legacyId', 'name', 'period'], legacyIdPrefix: 'PRUN' },
  { path: '/payroll-slips', model: PayrollSlip, resourceName: 'Payroll slip', searchFields: ['legacyId', 'employee', 'employeeId'], legacyIdPrefix: 'PS' },
  { path: '/production-orders', model: ProductionOrder, resourceName: 'Production order', searchFields: ['legacyId', 'product'], legacyIdPrefix: 'MO' },
  { path: '/machine-maintenance', model: MachineMaintenance, resourceName: 'Machine maintenance', searchFields: ['legacyId', 'machine'], legacyIdPrefix: 'MM' },
  { path: '/molds', model: Mold, resourceName: 'Mold', searchFields: ['legacyId', 'mold', 'product'], legacyIdPrefix: 'MOLD' },
  { path: '/wastage', model: Wastage, resourceName: 'Wastage', searchFields: ['legacyId', 'product', 'reason'], legacyIdPrefix: 'WST' },
  { path: '/packing', model: Packing, resourceName: 'Packing', searchFields: ['legacyId', 'batch', 'product'], legacyIdPrefix: 'PKG' },
  { path: '/journals', model: Journal, resourceName: 'Journal entry', searchFields: ['legacyId', 'account', 'desc'], legacyIdPrefix: 'JE' },
  { path: '/ledger', model: LedgerEntry, resourceName: 'Ledger entry', searchFields: ['legacyId', 'account', 'ref'], legacyIdPrefix: 'GL' },
  { path: '/dues', model: DueRecord, resourceName: 'Due record', searchFields: ['legacyId', 'party'], legacyIdPrefix: 'DUE' },
  { path: '/crm-activities', model: CrmActivity, resourceName: 'CRM activity', searchFields: ['legacyId', 'type', 'subject'], legacyIdPrefix: 'ACT' },
  { path: '/wholesale-orders', model: WholesaleOrder, resourceName: 'Wholesale order', searchFields: ['legacyId', 'buyer'], legacyIdPrefix: 'WS' },
  { path: '/users', model: AppUser, resourceName: 'User', searchFields: ['legacyId', 'name', 'email'], legacyIdPrefix: 'USR' },
  { path: '/roles', model: AppRole, resourceName: 'Role', searchFields: ['legacyId', 'name'], legacyIdPrefix: 'ROLE' },
  { path: '/permissions', model: AppPermission, resourceName: 'Permission', searchFields: ['legacyId', 'module', 'role'], legacyIdPrefix: 'PERM' },
  { path: '/documents', model: AppDocument, resourceName: 'Document', searchFields: ['legacyId', 'name', 'type'], legacyIdPrefix: 'DOC' },
  { path: '/company-settings', model: CompanySetting, resourceName: 'Company setting', searchFields: ['legacyId', 'field'], legacyIdPrefix: 'CO' },
  { path: '/projects', model: Project, resourceName: 'Project', searchFields: ['legacyId', 'name', 'customerName', 'projectId'], legacyIdPrefix: 'PROJ' },
  { path: '/assets', model: Asset, resourceName: 'Asset', searchFields: ['legacyId', 'name', 'asset', 'code'], legacyIdPrefix: 'AST' },
  { path: '/workflow-approvals', model: WorkflowApproval, resourceName: 'Workflow approval', searchFields: ['legacyId', 'name', 'module'], legacyIdPrefix: 'WF' },
  { path: '/audit-logs', model: AuditLog, resourceName: 'Audit log', searchFields: ['legacyId', 'action', 'user'], legacyIdPrefix: 'AUD' },
  { path: '/notifications', model: Notification, resourceName: 'Notification', searchFields: ['legacyId', 'title'], legacyIdPrefix: 'NOT' },
  { path: '/cashbox', model: CashboxEntry, resourceName: 'Cashbox entry', searchFields: ['legacyId', 'party', 'type'], legacyIdPrefix: 'CB' },
  { path: '/trial-balance', model: TrialBalanceLine, resourceName: 'Trial balance line', searchFields: ['legacyId', 'accountCode', 'accountName'], legacyIdPrefix: 'TB' },
  { path: '/profit-loss', model: ProfitLossLine, resourceName: 'Profit loss line', searchFields: ['legacyId', 'lineItem', 'category'], legacyIdPrefix: 'PL' },
  { path: '/balance-sheet', model: BalanceSheetLine, resourceName: 'Balance sheet line', searchFields: ['legacyId', 'lineItem', 'category'], legacyIdPrefix: 'BS' },
  { path: '/salary-sheet', model: SalarySheetEntry, resourceName: 'Salary sheet entry', searchFields: ['legacyId', 'employee', 'employeeId'], legacyIdPrefix: 'SSHT' },
];

export const EXTENDED_API_ENDPOINTS: Record<string, string> = Object.fromEntries(
  EXTENDED_RESOURCES.map((r) => [r.path.slice(1), r.path]),
);

export function registerExtendedRoutes(router: Router) {
  for (const def of EXTENDED_RESOURCES) {
    const ctrl = createCrudController(def.model, {
      resourceName: def.resourceName,
      searchFields: def.searchFields,
      defaultSort: { createdAt: -1 },
      legacyIdPrefix: def.legacyIdPrefix,
    });
    registerCrud(router, def.path, ctrl);
  }
}
