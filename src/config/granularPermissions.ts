export const INVENTORY_EDIT_PERMISSION = 'inventory:edit';

export const INVENTORY_MUTATION_PREFIXES = [
  '/products',
  '/categories',
  '/units',
  '/warehouses',
  '/raw-materials',
  '/semi-finished-products',
  '/finished-goods',
  '/stock-in',
  '/stock-out',
  '/stock-transfers',
  '/stock-adjustments',
] as const;

export function userCanEditInventory(user: { role?: string; allowedPermissions?: string[] } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return (user.allowedPermissions ?? []).includes(INVENTORY_EDIT_PERMISSION);
}

/** True when the request modifies existing inventory data (edit/delete/approve), not create. */
export function isInventoryEditRequiredPath(path: string, method: string): boolean {
  const verb = method.toUpperCase();
  const inInventoryScope = INVENTORY_MUTATION_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (!inInventoryScope) return false;

  if (path.endsWith('/seed')) return true;
  if (verb === 'POST' && (path.endsWith('/approve') || path.endsWith('/complete'))) return true;
  if (['PUT', 'PATCH', 'DELETE'].includes(verb)) return true;

  // POST create (e.g. POST /products) is allowed with section access only.
  return false;
}
