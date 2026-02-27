export const TRANSPORT_INTERNAL_PERMISSIONS = ['admin', 'master', 'expedicao', 'conferente'] as const;
export const USER_PERMISSION = 'user' as const;
export const CONTROL_TOWER_PERMISSION = 'control_tower' as const;

export const INTERNAL_PERMISSIONS = [...TRANSPORT_INTERNAL_PERMISSIONS, USER_PERMISSION] as const;
export const ADMIN_MASTER_PERMISSIONS = ['admin', 'master'] as const;
export const USER_ALLOWED_PERMISSIONS = [...TRANSPORT_INTERNAL_PERMISSIONS, USER_PERMISSION] as const;
const INTERNAL_PERMISSION_SET = new Set<string>(INTERNAL_PERMISSIONS);

export const getDefaultRouteByPermission = (permissionRaw: string) => {
  const permission = String(permissionRaw || '').trim().toLowerCase();

  if (permission === CONTROL_TOWER_PERMISSION) {
    return '/control-tower/coletas';
  }

  if (permission === USER_PERMISSION) {
    return '/invoices';
  }

  if (INTERNAL_PERMISSION_SET.has(permission)) {
    return '/home';
  }

  return '/';
};
