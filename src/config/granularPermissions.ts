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

export function isInventoryMutationPath(path: string, method: string): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return false;
  if (path.endsWith('/seed')) return true;
  return INVENTORY_MUTATION_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
