/** Mongoose `.select()` projections for list endpoints — omit heavy meta/notes fields. */
export const LIST_FIELD_PROFILES: Record<string, string> = {
  Customer: 'legacyId tenantId name company email phone status totalDue creditLimit ownerId ownerName createdAt updatedAt',
  Product: 'legacyId tenantId name sku category status price cost stock reorderLevel unit createdAt updatedAt',
  Supplier: 'legacyId tenantId name code email phone status due balance createdAt updatedAt',
  Employee: 'legacyId tenantId name employeeCode department designation status phone email joinDate createdAt updatedAt',
  'Sales order': 'legacyId tenantId customer customerName status total date createdAt updatedAt',
  Invoice: 'legacyId tenantId customer customerName status total issueDate date dueDate createdAt updatedAt',
  Lead: 'legacyId tenantId name company phone email source status priority assignedRepId assignedRepName expectedValue nextFollowUpAt nextActionType createdAt updatedAt',
  Deal: 'legacyId tenantId title company status stage value probability assignedRepId assignedRepName expectedCloseDate createdAt updatedAt',
  Quotation: 'legacyId tenantId customer customerName status total date createdAt updatedAt',
  Delivery: 'legacyId tenantId customer customerName status total date createdAt updatedAt',
  Dispatch: 'legacyId tenantId customer customerName status date createdAt updatedAt',
  Payment: 'legacyId tenantId customer customerName amount method date status createdAt updatedAt',
  Return: 'legacyId tenantId customer customerName status total date createdAt updatedAt',
  Complaint: 'legacyId tenantId subject customerName status priority date createdAt updatedAt',
  'POS transaction': 'legacyId tenantId receiptNo total status date createdAt updatedAt',
  Category: 'legacyId tenantId name status createdAt updatedAt',
  Unit: 'legacyId tenantId name code status createdAt updatedAt',
  Warehouse: 'legacyId tenantId name location status createdAt updatedAt',
  'Raw material': 'legacyId tenantId name category sku unit stock reorderLevel cost price status createdAt updatedAt',
  'Semi-finished product': 'legacyId tenantId name category sku unit stock reorderLevel cost status createdAt updatedAt',
  'Finished good': 'legacyId tenantId name category sku unit stock reorderLevel cost price status createdAt updatedAt',
  'Stock in': 'legacyId tenantId reference status warehouse date createdAt updatedAt',
  'Stock out': 'legacyId tenantId reference status warehouse date createdAt updatedAt',
  'Stock transfer': 'legacyId tenantId reference status fromWarehouse toWarehouse date createdAt updatedAt',
  'Stock adjustment': 'legacyId tenantId reference status warehouse date createdAt updatedAt',
};

export function listFieldsFor(resourceName: string): string | undefined {
  return LIST_FIELD_PROFILES[resourceName];
}
