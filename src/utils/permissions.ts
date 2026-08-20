export const TRANSPORT_INTERNAL_PERMISSIONS = ['admin', 'master', 'expedicao', 'conferente'] as const;
export const USER_PERMISSION = 'user' as const;
export const CONTROL_TOWER_PERMISSION = 'control_tower' as const;

export const INTERNAL_PERMISSIONS = [...TRANSPORT_INTERNAL_PERMISSIONS, USER_PERMISSION] as const;
export const ADMIN_MASTER_PERMISSIONS = ['admin', 'master'] as const;
export const USER_ALLOWED_PERMISSIONS = [...TRANSPORT_INTERNAL_PERMISSIONS, USER_PERMISSION] as const;
const INTERNAL_PERMISSION_SET = new Set<string>(INTERNAL_PERMISSIONS);

export const ROUTE_PERMISSIONS: Record<string, readonly string[]> = {
  '/home': TRANSPORT_INTERNAL_PERMISSIONS,
  '/todayInvoices': USER_ALLOWED_PERMISSIONS,
  '/invoices': USER_ALLOWED_PERMISSIONS,
  '/invoice-journey': USER_ALLOWED_PERMISSIONS,
  '/invoices/:invoiceNumber/journey': USER_ALLOWED_PERMISSIONS,
  '/operational-pendencies': USER_ALLOWED_PERMISSIONS,
  '/alerts': USER_ALLOWED_PERMISSIONS,
  '/delivery-monitoring': [...USER_ALLOWED_PERMISSIONS, CONTROL_TOWER_PERMISSION],
  '/daily-operation-closing': TRANSPORT_INTERNAL_PERMISSIONS,
  '/receipt-bag-closing': TRANSPORT_INTERNAL_PERMISSIONS,
  '/products': USER_ALLOWED_PERMISSIONS,
  '/routePlanning': TRANSPORT_INTERNAL_PERMISSIONS,
  '/customers': USER_ALLOWED_PERMISSIONS,
  '/trips': TRANSPORT_INTERNAL_PERMISSIONS,
  '/uploadFiles': TRANSPORT_INTERNAL_PERMISSIONS,
  '/cte-management': TRANSPORT_INTERNAL_PERMISSIONS,
  '/returns-occurrences': [...TRANSPORT_INTERNAL_PERMISSIONS, CONTROL_TOWER_PERMISSION],
  '/returns-occurrences/base': [...USER_ALLOWED_PERMISSIONS, CONTROL_TOWER_PERMISSION],
  '/users': ADMIN_MASTER_PERMISSIONS,
  '/user-sessions': ['master'],
  '/whatsapp-bot/connect': ['master'],
  '/control-tower/coletas': [CONTROL_TOWER_PERMISSION, 'admin', 'master', 'expedicao'],
};

export const getRoutePermissions = (route: string): readonly string[] => ROUTE_PERMISSIONS[route] || [];
export const canAccessRoute = (permissionRaw: string, route: string) => (
  getRoutePermissions(route).includes(String(permissionRaw || '').trim().toLowerCase())
);

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
