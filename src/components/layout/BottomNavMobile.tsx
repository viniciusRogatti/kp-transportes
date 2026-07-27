import { Building2, Home, NotebookText, Package, Search, Undo2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { useTheme } from '../../context/ThemeContext';

type BottomNavItem = {
  key: string;
  to: string;
  label: string;
  ariaLabel: string;
  icon: JSX.Element;
  isHome?: boolean;
};

const defaultBottomNavItems: BottomNavItem[] = [
  {
    key: 'today',
    to: '/todayInvoices',
    label: 'Hoje',
    ariaLabel: 'Ir para Notas do dia',
    icon: <NotebookText className="h-[1.1rem] w-[1.1rem]" />,
  },
  {
    key: 'returns',
    to: '/returns-occurrences',
    label: 'Devoluções',
    ariaLabel: 'Ir para Devoluções',
    icon: <Undo2 className="h-[1.1rem] w-[1.1rem]" />,
  },
  {
    key: 'home',
    to: '/home',
    label: 'Início',
    ariaLabel: 'Ir para Início',
    icon: <Home className="h-[1.45rem] w-[1.45rem]" />,
    isHome: true,
  },
  {
    key: 'products',
    to: '/products',
    label: 'Produtos',
    ariaLabel: 'Ir para Produtos',
    icon: <Package className="h-[1.1rem] w-[1.1rem]" />,
  },
  {
    key: 'customers',
    to: '/customers',
    label: 'Clientes',
    ariaLabel: 'Ir para Clientes',
    icon: <Building2 className="h-[1.1rem] w-[1.1rem]" />,
  },
];

const userBottomNavItems: BottomNavItem[] = [
  {
    key: 'today',
    to: '/todayInvoices',
    label: 'Hoje',
    ariaLabel: 'Ir para Notas do dia',
    icon: <NotebookText className="h-[1.1rem] w-[1.1rem]" />,
  },
  {
    key: 'search',
    to: '/invoices',
    label: 'Notas',
    ariaLabel: 'Ir para Pesquisar Notas',
    icon: <Search className="h-[1.1rem] w-[1.1rem]" />,
  },
  {
    key: 'products',
    to: '/products',
    label: 'Produtos',
    ariaLabel: 'Ir para Produtos',
    icon: <Package className="h-[1.1rem] w-[1.1rem]" />,
  },
  {
    key: 'customers',
    to: '/customers',
    label: 'Clientes',
    ariaLabel: 'Ir para Clientes',
    icon: <Building2 className="h-[1.1rem] w-[1.1rem]" />,
  },
];

function BottomNavMobile() {
  const navigate = useNavigate();
  const location = useLocation();
  const permission = String(localStorage.getItem('user_permission') || '').trim().toLowerCase();
  const { isLightTheme } = useTheme();

  if (permission === 'control_tower' || location.pathname.startsWith('/control-tower')) {
    return null;
  }

  const bottomNavItems = permission === 'user' ? userBottomNavItems : defaultBottomNavItems;
  const navPaths = new Set(bottomNavItems.map((item) => item.to));
  const defaultPath = permission === 'user' ? '/invoices' : '/home';
  const hasActiveItem = navPaths.has(location.pathname);
  const activePath = hasActiveItem ? location.pathname : defaultPath;

  return (
    <nav
      aria-label="Menu principal mobile"
      className="app-shell-bottom-nav fixed inset-x-0 bottom-0 z-[1160] hidden border-t border-border max-[768px]:block"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
    >
      <div className={cn(
        'mx-auto grid h-[var(--mobile-bottom-nav-height)] max-w-[720px] items-end px-1',
        bottomNavItems.length === 4 ? 'grid-cols-4' : 'grid-cols-5',
      )}>
        {bottomNavItems.map((item) => {
          const isActive = activePath === item.to;

          return (
            <button
              key={item.key}
              type="button"
              aria-label={item.ariaLabel}
              onClick={() => {
                if (location.pathname === item.to) return;
                navigate(item.to);
              }}
              className={cn(
                'group relative flex min-h-[44px] flex-col items-center justify-center rounded-md px-1 pb-2 pt-1 text-[10px] font-semibold transition duration-150 active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/80',
                isActive ? (isLightTheme ? 'text-sky-900' : 'text-white') : 'text-muted',
                item.isHome ? '-mt-5 pb-1' : '',
              )}
            >
              {item.isHome ? (
                <span
                  className={cn(
                    'relative inline-flex h-14 w-14 items-center justify-center rounded-lg border transition-transform duration-150',
                    isActive
                      ? 'border-accent bg-accent text-white shadow-elevated'
                      : 'border-border bg-surface-2 text-text shadow-soft',
                    'group-hover:-translate-y-0.5 group-active:translate-y-0',
                  )}
                >
                  {item.icon}
                </span>
              ) : (
                <span
                  className={cn(
                    'relative inline-flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150',
                    isActive
                      ? 'border-accent bg-accent text-white -translate-y-0.5 shadow-soft'
                      : 'border-border bg-surface-2 text-text group-hover:-translate-y-0.5 group-hover:text-text',
                  )}
                >
                  {item.icon}
                </span>
              )}
              <span className={cn('mt-1 leading-none', item.isHome ? 'text-[11px]' : '')}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavMobile;
