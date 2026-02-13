import { Building2, Home, NotebookText, Package, Undo2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';

type BottomNavItem = {
  key: string;
  to: string;
  label: string;
  ariaLabel: string;
  icon: JSX.Element;
  isHome?: boolean;
};

const bottomNavItems: BottomNavItem[] = [
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
    label: 'Home',
    ariaLabel: 'Ir para Home',
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

const navPaths = new Set(bottomNavItems.map((item) => item.to));

function BottomNavMobile() {
  const navigate = useNavigate();
  const location = useLocation();
  const permission = localStorage.getItem('user_permission') || '';

  if (permission === 'control_tower' || location.pathname.startsWith('/control-tower')) {
    return null;
  }

  const hasActiveItem = navPaths.has(location.pathname);
  const activePath = hasActiveItem ? location.pathname : '/home';

  return (
    <nav
      aria-label="Menu principal mobile"
      className="fixed inset-x-0 bottom-0 z-[1160] hidden border-t border-border bg-[rgba(6,13,25,0.96)] shadow-[0_-10px_28px_rgba(1,8,20,0.55)] backdrop-blur-xl max-[768px]:block"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
    >
      <div className="mx-auto grid h-[var(--mobile-bottom-nav-height)] max-w-[720px] grid-cols-5 items-end px-1">
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
                'group relative flex min-h-[44px] flex-col items-center justify-center rounded-xl px-1 pb-2 pt-1 text-[10px] font-semibold transition duration-150 active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/80',
                isActive ? 'text-white' : 'text-muted',
                item.isHome ? '-mt-5 pb-1' : '',
              )}
            >
              {item.isHome ? (
                <span
                  className={cn(
                    'relative inline-flex h-14 w-14 items-center justify-center rounded-2xl border transition-transform duration-150',
                    isActive
                      ? 'border-sky-400/70 bg-gradient-to-b from-[#1674d8] to-[#0157a3] text-white shadow-[0_10px_24px_rgba(4,87,163,0.55)]'
                      : 'border-border bg-surface-2 text-white shadow-[0_7px_16px_rgba(1,8,20,0.35)]',
                    'group-hover:-translate-y-0.5 group-active:translate-y-0',
                  )}
                >
                  {item.icon}
                  <span className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_rgba(142,208,255,0.2)]" />
                </span>
              ) : (
                <span
                  className={cn(
                    'relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150',
                    isActive
                      ? 'border-sky-400/70 bg-gradient-to-b from-[#1674d8] to-[#0157a3] text-white -translate-y-0.5 shadow-[0_8px_20px_rgba(4,87,163,0.45)]'
                      : 'border-border bg-surface-2/70 text-white group-hover:-translate-y-0.5 group-hover:text-white',
                  )}
                >
                  {item.icon}
                  {isActive ? <span className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_0_1px_rgba(142,208,255,0.2)]" /> : null}
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
