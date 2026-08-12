import type { Request, Response } from 'express';
import {
  Customer,
  Supplier,
  Employee,
  SalesOrder,
  Invoice,
  Product,
  RawMaterial,
  SemiFinishedProduct,
  FinishedGood,
  Warehouse,
} from '../models/index.js';
import {
  PurchaseOrder,
  Department,
  LeaveRequest,
  Journal,
  LedgerEntry,
} from '../models/extendedResources.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { listFieldsFor } from '../config/listFieldProfiles.js';

const REPORT_LIMIT = 300;

function tenantFilter(tenantId: string) {
  return { tenantId };
}

function selectFields(resourceName: string): string {
  return listFieldsFor(resourceName) ?? 'legacyId tenantId createdAt updatedAt';
}

function serializeDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const id = String(doc._id ?? doc.id ?? '');
  const { _id, __v, ...rest } = doc;
  return { ...rest, id };
}

function mapSalesRow(doc: Record<string, unknown>, kind: 'invoice' | 'order') {
  return {
    id: doc.id ?? doc.legacyId,
    date: String(doc.date ?? doc.issueDate ?? doc.createdAt ?? '').slice(0, 10),
    ref: doc.legacyId ?? doc.id,
    customer: doc.customerName ?? doc.customer ?? '',
    status: doc.status ?? (kind === 'invoice' ? 'Unpaid' : 'draft'),
    paymentMethod: doc.paymentMethod ?? doc.paymentTerms ?? 'Cash',
    total: Number(doc.total ?? doc.grandTotal ?? doc.amount ?? 0),
  };
}

function mapPurchaseRow(doc: Record<string, unknown>) {
  const total = Number(doc.total ?? (Number(doc.qty ?? 0) * Number(doc.unitCost ?? 0)));
  const received = doc.status === 'Received' ? total : Number(doc.received ?? 0);
  return {
    id: doc.id ?? doc.legacyId,
    date: String(doc.date ?? doc.createdAt ?? '').slice(0, 10),
    ref: doc.legacyId ?? doc.id,
    supplier: doc.supplier ?? doc.supplierName ?? '',
    status: doc.status ?? 'Draft',
    paymentStatus: doc.paymentStatus ?? 'unpaid',
    total,
    received,
    pending: Math.max(0, total - received),
  };
}

function mapInventoryRow(doc: Record<string, unknown>, whMap: Map<string, string>) {
  const qty = Number(doc.stock ?? doc.quantity ?? 0);
  const cost = Number(doc.cost ?? doc.price ?? 0);
  const reorder = Number(doc.reorderLevel ?? doc.minStock ?? 0);
  const ws = (doc.warehouseStock ?? {}) as Record<string, number>;
  const whId = Object.keys(ws).find((k) => Number(ws[k]) > 0) ?? String(doc.defaultWarehouse ?? '');
  return {
    id: doc.id ?? doc.legacyId,
    sku: doc.sku ?? doc.legacyId ?? '',
    name: doc.name ?? '',
    category: doc.category ?? 'Uncategorized',
    warehouse: whMap.get(whId) ?? whId ?? '—',
    qty,
    cost,
    reorderLevel: reorder,
    image: doc.imageUrl ?? '',
    value: qty * cost,
    status: qty <= reorder ? 'Low Stock' : 'In Stock',
  };
}

export const getSalesReport = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const invoiceProj = selectFields('Invoice');
  const orderProj = selectFields('Sales order');

  const [invoices, orders] = await Promise.all([
    Invoice.find(filter).select(invoiceProj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean(),
    SalesOrder.find(filter).select(orderProj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean(),
  ]);

  const invoiceRows = invoices.map((doc) => mapSalesRow(serializeDoc(doc as Record<string, unknown>), 'invoice'));
  const rows = invoiceRows.length > 0
    ? invoiceRows
    : orders.map((doc) => mapSalesRow(serializeDoc(doc as Record<string, unknown>), 'order'));

  sendSuccess(res, { rows }, { total: rows.length });
});

export const getPurchaseReport = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const proj = selectFields('Purchase order');
  const docs = await PurchaseOrder.find(filter).select(proj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean();
  const rows = docs.map((doc) => mapPurchaseRow(serializeDoc(doc as Record<string, unknown>)));
  sendSuccess(res, { rows }, { total: rows.length });
});

export const getInventoryReport = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const whProj = selectFields('Warehouse');
  const warehouses = await Warehouse.find(filter).select(whProj).lean();
  const whMap = new Map(warehouses.map((w) => [String(w._id), String((w as Record<string, unknown>).name ?? w._id)]));

  const [products, raw, finished, semi] = await Promise.all([
    Product.find(filter).select(selectFields('Product')).sort({ createdAt: -1 }).limit(100).lean(),
    RawMaterial.find(filter).select(selectFields('Raw material')).sort({ createdAt: -1 }).limit(100).lean(),
    FinishedGood.find(filter).select(selectFields('Finished good')).sort({ createdAt: -1 }).limit(100).lean(),
    SemiFinishedProduct.find(filter).select(selectFields('Semi-finished product')).sort({ createdAt: -1 }).limit(100).lean(),
  ]);

  const rows = [
    ...products.map((d) => mapInventoryRow(serializeDoc(d as Record<string, unknown>), whMap)),
    ...raw.map((d) => mapInventoryRow(serializeDoc(d as Record<string, unknown>), whMap)),
    ...finished.map((d) => mapInventoryRow(serializeDoc(d as Record<string, unknown>), whMap)),
    ...semi.map((d) => mapInventoryRow(serializeDoc(d as Record<string, unknown>), whMap)),
  ];

  sendSuccess(res, { rows }, { total: rows.length });
});

export const getCustomerReport = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const custProj = selectFields('Customer');
  const invProj = selectFields('Invoice');

  const [customers, invoices] = await Promise.all([
    Customer.find(filter).select(custProj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean(),
    Invoice.find(filter).select(invProj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean(),
  ]);

  const rows = customers.map((doc) => {
    const c = serializeDoc(doc as Record<string, unknown>);
    const custInvoices = invoices.filter((inv) => {
      const row = inv as Record<string, unknown>;
      return String(row.customerId) === String(c.id)
        || String(row.customerName ?? '').toLowerCase() === String(c.name ?? '').toLowerCase();
    });
    const totalSpent = custInvoices.reduce((s, inv) => {
      const row = inv as Record<string, unknown>;
      return s + Number(row.amount ?? row.total ?? 0);
    }, 0);
    return {
      id: c.id ?? c.legacyId,
      name: c.name ?? '',
      company: c.company ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      status: c.status ?? 'active',
      totalOrders: custInvoices.length,
      totalSpent,
      due: Number(c.totalDue ?? c.due ?? 0),
    };
  });

  sendSuccess(res, { rows }, { total: rows.length });
});

export const getSupplierReport = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const supProj = selectFields('Supplier');
  const poProj = selectFields('Purchase order');

  const [suppliers, orders] = await Promise.all([
    Supplier.find(filter).select(supProj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean(),
    PurchaseOrder.find(filter).select(poProj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean(),
  ]);

  const rows = suppliers.map((doc) => {
    const s = serializeDoc(doc as Record<string, unknown>);
    const supplierPos = orders.filter((po) => {
      const row = po as Record<string, unknown>;
      return String(row.supplierId ?? row.supplier) === String(s.id)
        || String(row.supplier ?? '').toLowerCase() === String(s.name ?? '').toLowerCase();
    });
    const totalSpend = supplierPos.reduce((sum, po) => {
      const row = po as Record<string, unknown>;
      return sum + Number(row.total ?? 0);
    }, 0);
    return {
      id: s.id ?? s.legacyId,
      name: s.name ?? '',
      contact: s.contactName ?? s.contact ?? '',
      phone: s.phone ?? '',
      status: s.status ?? 'active',
      totalOrders: supplierPos.length,
      totalSpend,
      due: Number(s.due ?? s.balance ?? 0),
    };
  });

  sendSuccess(res, { rows }, { total: rows.length });
});

export const getFinancialReport = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const journalProj = selectFields('Journal');
  const ledgerProj = selectFields('Ledger entry');

  const [journals, ledger] = await Promise.all([
    Journal.find(filter).select(journalProj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean(),
    LedgerEntry.find(filter).select(ledgerProj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean(),
  ]);

  const journalRows = journals.map((doc) => {
    const d = serializeDoc(doc as Record<string, unknown>);
    return {
      id: d.id ?? d.legacyId,
      date: String(d.date ?? d.createdAt ?? '').slice(0, 10),
      ref: d.legacyId ?? d.id,
      account: d.account ?? '',
      desc: d.desc ?? d.description ?? '',
      debit: Number(d.debit ?? 0),
      credit: Number(d.credit ?? 0),
      category: d.category ?? 'General',
    };
  });

  const ledgerRows = ledger.map((doc) => {
    const d = serializeDoc(doc as Record<string, unknown>);
    return {
      id: d.id ?? d.legacyId,
      date: String(d.date ?? d.createdAt ?? '').slice(0, 10),
      ref: d.ref ?? d.legacyId ?? d.id,
      account: d.account ?? '',
      desc: d.desc ?? d.description ?? '',
      debit: Number(d.debit ?? 0),
      credit: Number(d.credit ?? 0),
      category: d.category ?? 'General',
    };
  });

  const rows = journalRows.length > 0 ? journalRows : ledgerRows;
  sendSuccess(res, { rows }, { total: rows.length });
});

export const getHrReport = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const empProj = selectFields('Employee');
  const deptProj = selectFields('Department');
  const leaveProj = selectFields('Leave request');

  const [employees, departments, leaveRequests] = await Promise.all([
    Employee.find(filter).select(empProj).sort({ createdAt: -1 }).limit(REPORT_LIMIT).lean(),
    Department.find(filter).select(deptProj).sort({ createdAt: -1 }).limit(100).lean(),
    LeaveRequest.find(filter).select(leaveProj).sort({ createdAt: -1 }).limit(100).lean(),
  ]);

  const empRows = employees.map((e) => serializeDoc(e as Record<string, unknown>));

  const departmentRows = departments.map((doc) => {
    const d = serializeDoc(doc as Record<string, unknown>);
    const deptName = String(d.name ?? d.department ?? '');
    const deptEmployees = empRows.filter((e) => String(e.department) === deptName);
    const male = deptEmployees.filter((e) => String(e.gender).toLowerCase() === 'male').length;
    const female = deptEmployees.filter((e) => String(e.gender).toLowerCase() === 'female').length;
    return {
      id: d.id ?? d.legacyId,
      department: deptName,
      total: deptEmployees.length || Number(d.employees ?? d.employeeCount ?? 0),
      male,
      female,
      joined: 0,
      left: 0,
      netChange: 0,
    };
  });

  const joinerRows = empRows.map((e) => ({
    id: e.id ?? e.legacyId,
    employeeId: e.legacyId ?? e.id,
    name: e.name ?? '',
    department: e.department ?? '',
    designation: e.designation ?? '',
    joinDate: String(e.joinDate ?? e.joiningDate ?? e.dateOfJoining ?? '').slice(0, 10),
  }));

  const leaverRows = leaveRequests.map((l) => {
    const row = serializeDoc(l as Record<string, unknown>);
    return {
      id: row.id ?? row.legacyId,
      employeeId: row.employeeId ?? '',
      name: row.employeeName ?? row.name ?? '',
      department: row.department ?? '',
      designation: row.designation ?? '',
      leftDate: String(row.endDate ?? row.date ?? '').slice(0, 10),
    };
  });

  const birthdayRows = empRows
    .filter((e) => e.dateOfBirth || e.birthDate)
    .map((e) => ({
      id: e.id ?? e.legacyId,
      employeeId: e.legacyId ?? e.id,
      name: e.name ?? '',
      department: e.department ?? '',
      birthDate: String(e.dateOfBirth ?? e.birthDate ?? '').slice(0, 10),
    }));

  sendSuccess(res, {
    departments: departmentRows,
    joiners: joinerRows,
    leavers: leaverRows,
    birthdays: birthdayRows,
  });
});
