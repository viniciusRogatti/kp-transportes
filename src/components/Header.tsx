import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardList,
  FileArchive,
  Home,
  Menu,
  Route,
  Search,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../lib/cn';
import BottomNavMobile from './layout/BottomNavMobile';
import ThemeToggleButton from './ui/ThemeToggleButton';
import { useRealtimeNotifications } from '../providers/RealtimeNotificationsProvider';
import { logoutSession } from '../utils/logoutSession';
import {
  ADMIN_MASTER_PERMISSIONS,
  TRANSPORT_INTERNAL_PERMISSIONS,
  USER_ALLOWED_PERMISSIONS,
} from '../utils/permissions';

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: JSX.Element;
  allowedPermissions: string[];
};

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  COLLECTION_CREATED: 'Coleta solicitada',
  COLLECTION_SCHEDULED: 'Coleta agendada',
  RETURN_BATCH_SENT: 'Lote enviado',
  OCCURRENCE_CREATED: 'Ocorrencia para credito',
  OCCURRENCE_ON_BATCH: 'Ocorrencia no lote',
};

const formatNotificationTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'agora';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

const navItems: NavItem[] = [
  { to: '/home', label: 'Home', shortLabel: 'Home', icon: <Home className="h-4 w-4" />, allowedPermissions: [...TRANSPORT_INTERNAL_PERMISSIONS] },
  { to: '/todayInvoices', label: 'Notas do Dia', shortLabel: 'Hoje', icon: <CalendarDays className="h-4 w-4" />, allowedPermissions: [...USER_ALLOWED_PERMISSIONS] },
  { to: '/invoices', label: 'Pesquisar Notas', shortLabel: 'Notas', icon: <Search className="h-4 w-4" />, allowedPermissions: [...USER_ALLOWED_PERMISSIONS] },
  { to: '/products', label: 'Itens Cadastrados', shortLabel: 'Itens', icon: <ClipboardList className="h-4 w-4" />, allowedPermissions: [...USER_ALLOWED_PERMISSIONS] },
  { to: '/customers', label: 'Clientes', shortLabel: 'Clientes', icon: <Users className="h-4 w-4" />, allowedPermissions: [...USER_ALLOWED_PERMISSIONS] },
  { to: '/routePlanning', label: 'Roteirização', shortLabel: 'Rotas', icon: <Route className="h-4 w-4" />, allowedPermissions: [...TRANSPORT_INTERNAL_PERMISSIONS] },
  { to: '/returns-occurrences', label: 'Devolução/Ocorrência', shortLabel: 'Dev/Ocorr', icon: <FileArchive className="h-4 w-4" />, allowedPermissions: [...TRANSPORT_INTERNAL_PERMISSIONS] },
  { to: '/uploadFiles', label: 'Enviar XML', shortLabel: 'XML', icon: <Upload className="h-4 w-4" />, allowedPermissions: [...TRANSPORT_INTERNAL_PERMISSIONS] },
  { to: '/users', label: 'Usuários', shortLabel: 'Usuários', icon: <UserPlus className="h-4 w-4" />, allowedPermissions: [...ADMIN_MASTER_PERMISSIONS] },
  { to: '/user-sessions', label: 'Horários', shortLabel: 'Horários', icon: <Clock3 className="h-4 w-4" />, allowedPermissions: ['master'] },
];

const routeTitles: Record<string, string> = {
  '/home': 'Painel Operacional',
  '/todayInvoices': 'Notas do Dia',
  '/invoices': 'Pesquisar Notas',
  '/products': 'Itens Cadastrados',
  '/customers': 'Clientes',
  '/routePlanning': 'Roteirização',
  '/trips': 'Roteirização',
  '/returns-occurrences': 'Devoluções e Ocorrências',
  '/uploadFiles': 'Envio de XML',
  '/users': 'Gerenciamento de Usuários',
  '/user-sessions': 'Horário de Sessões',
  '/control-tower/coletas': 'Torre de Controle',
};

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    notifications,
    unreadCount,
    connected,
    markAsRead,
  } = useRealtimeNotifications();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const desktopSidebarRef = useRef<HTMLElement | null>(null);
  const topbarRef = useRef<HTMLElement | null>(null);

  const currentTitle = routeTitles[location.pathname] || 'KP Transportes';
  const currentSection = location.pathname.startsWith('/control-tower') ? 'Control Tower' : 'Operação';
  const permission = String(localStorage.getItem('user_permission') || 'user').trim().toLowerCase();
  const userDisplayName = String(localStorage.getItem('user_name') || localStorage.getItem('user_login') || permission || 'Usuário').trim();
  const latestNotifications = notifications.slice(0, 10);
  const visibleNavItems = navItems.filter((item) => item.allowedPermissions.includes(permission));

  useEffect(() => {
    document.body.classList.add('with-app-shell');
    document.documentElement.style.setProperty(
      '--app-sidebar-current',
      isSidebarCollapsed ? 'var(--app-sidebar-width-collapsed)' : 'var(--app-sidebar-width)',
    );

    return () => {
      document.body.classList.remove('with-app-shell');
      document.documentElement.style.setProperty('--app-sidebar-current', 'var(--app-sidebar-width)');
    };
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutsideShell = (event: MouseEvent) => {
      if (isSidebarCollapsed || window.innerWidth < 768) return;
      const target = event.target as Node | null;
      if (!target) return;

      const clickedSidebar = desktopSidebarRef.current?.contains(target);
      const clickedTopbar = topbarRef.current?.contains(target);

      if (!clickedSidebar && !clickedTopbar) {
        setIsSidebarCollapsed(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideShell);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideShell);
    };
  }, [isSidebarCollapsed]);

  async function handleLogout() {
    await logoutSession();
    navigate('/');
  }

  function runQuickSearch() {
    const value = quickSearch.trim();
    if (!value) return;
    navigate(`/invoices?nf=${encodeURIComponent(value)}`);
    setQuickSearch('');
  }

  return (
    <>
      <aside
        ref={desktopSidebarRef}
        className={cn(
          'app-shell-sidebar fixed left-0 top-0 z-[1200] hidden h-screen border-r border-border px-3 py-3 shadow-[var(--shadow-2)] backdrop-blur md:flex md:flex-col md:transition-[width] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)]',
          isSidebarCollapsed ? 'w-[var(--app-sidebar-width-collapsed)]' : 'w-[var(--app-sidebar-width)]',
        )}
      >
        <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-surface/80 px-2 py-2">
          <div className={cn('overflow-hidden transition-all duration-300 ease-out', isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100')}>
            <p className="text-xs uppercase tracking-wide text-muted">KP Transportes</p>
            <strong className="text-sm text-text">Operações</strong>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2 text-text"
            title={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="scrollbar-ui flex-1 space-y-1 overflow-auto pr-1">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'group flex items-center rounded-md border py-2 text-sm transition',
                  isSidebarCollapsed ? 'justify-center px-1' : 'gap-2 px-2.5',
                  isActive
                    ? 'border-sky-500/70 bg-gradient-to-r from-[#1674d8]/85 to-[#0157a3]/85 text-white shadow-[0_8px_18px_rgba(4,87,163,0.35)]'
                    : 'border-transparent text-muted hover:border-border hover:bg-surface/70 hover:text-text',
                )}
                title={item.label}
              >
                <span className={cn(
                  'inline-flex items-center justify-center rounded-md border',
                  isActive
                    ? 'border-sky-300/70 bg-gradient-to-b from-[#1c7fe0] to-[#0157a3] text-white shadow-[0_8px_18px_rgba(4,87,163,0.35)]'
                    : 'border-border bg-surface-2 text-text',
                  isSidebarCollapsed ? 'h-9 w-9' : 'h-8 w-8',
                )}>
                  {item.icon}
                </span>
                <span className={cn('whitespace-nowrap transition-all duration-300 ease-out', isSidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'opacity-100')}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-md border border-rose-500/80 bg-gradient-to-r from-rose-700 to-rose-600 px-3 text-sm font-semibold text-rose-50 shadow-[0_10px_20px_rgba(190,24,93,0.35)] transition hover:from-rose-600 hover:to-rose-500"
        >
          {isSidebarCollapsed ? 'Sair' : 'Sair da sessão'}
        </button>
      </aside>

      <header ref={topbarRef} className="app-shell-topbar fixed left-0 right-0 top-0 z-[1100] h-[var(--header-height)] border-b border-border px-3 backdrop-blur-xl md:left-[var(--app-sidebar-current)] md:px-4 md:transition-[left] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)]">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface/80 text-text md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-wide text-muted">{currentSection} / {permission}</p>
              <h1 className="truncate text-[1.05rem] font-semibold text-text">{currentTitle}</h1>
            </div>
          </div>

          <div className="hidden w-full max-w-[360px] items-center gap-2 rounded-md border border-border bg-surface/85 px-2 md:flex">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runQuickSearch();
              }}
              placeholder="Busca rápida por NF"
              className="h-9 w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggleButton iconOnly />
            <button
              type="button"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface/80 text-text"
              aria-label="Abrir notificações"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>
            <div className="hidden items-center gap-2 rounded-md border border-border bg-surface/80 px-2 py-1.5 md:flex">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2">
                <User className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-muted">Usuário</p>
                <p className="text-sm font-medium text-text">{userDisplayName}</p>
              </div>
            </div>
          </div>
        </div>

        {isNotificationOpen ? (
          <div className="absolute right-3 top-[calc(var(--header-height)+8px)] z-[1200] w-[min(92vw,360px)] rounded-md border border-border bg-surface p-3 shadow-[var(--shadow-3)] md:right-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">Notificações</h3>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                connected
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-500'
                  : 'border-amber-500/60 bg-amber-500/10 text-amber-500',
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-amber-500')} />
                {connected ? 'Realtime ON' : 'Fallback polling'}
              </span>
            </div>

            <p className="mt-1 text-xs text-muted">
              {unreadCount > 0
                ? `${unreadCount} notificação(ões) não lida(s)`
                : 'Sem notificações não lidas.'}
            </p>

            {!latestNotifications.length ? (
              <p className="mt-3 rounded-md border border-border bg-surface-2/70 px-2 py-2 text-xs text-muted">
                Nenhuma notificação disponível.
              </p>
            ) : (
              <ul className="mt-3 max-h-[340px] space-y-1 overflow-auto pr-1">
                {latestNotifications.map((notification) => {
                  const typeLabel = NOTIFICATION_TYPE_LABELS[notification.type] || notification.type;
                  const isUnread = !notification.read;
                  return (
                    <li key={`notif-${notification.id}`}>
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        className={cn(
                          'w-full rounded-md border px-2 py-2 text-left transition',
                          isUnread
                            ? 'border-sky-500/60 bg-sky-100 hover:bg-sky-100'
                            : 'border-border bg-surface-2/70 hover:bg-surface-2',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-text">{typeLabel}</span>
                          <span className="text-[11px] text-muted">{formatNotificationTime(notification.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-text">{notification.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{notification.message}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </header>

      <div
        onClick={() => setIsMobileDrawerOpen(false)}
        className={cn(
          'fixed inset-0 z-[1190] bg-black/55 transition-opacity duration-300 ease-out md:hidden',
          isMobileDrawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'app-shell-mobile-drawer fixed left-0 top-0 z-[1200] h-dvh w-[min(85vw,320px)] border-r border-border p-3 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden',
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Menu</p>
            <h2 className="text-base font-semibold text-text">Navegação</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface/80 text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ThemeToggleButton className="mb-3 w-full justify-center" />

        <nav className="scrollbar-ui space-y-1 overflow-auto pb-3">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm',
                  isActive
                    ? 'border-sky-500/70 bg-gradient-to-r from-[#1674d8]/85 to-[#0157a3]/85 text-white shadow-[0_8px_18px_rgba(4,87,163,0.35)]'
                    : 'border-transparent text-muted',
                )}
              >
                <span className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-md border',
                  isActive
                    ? 'border-sky-300/70 bg-gradient-to-b from-[#1c7fe0] to-[#0157a3] text-white'
                    : 'border-border bg-surface-2 text-text',
                )}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md border border-rose-500/80 bg-gradient-to-r from-rose-700 to-rose-600 text-sm font-semibold text-rose-50 shadow-[0_10px_20px_rgba(190,24,93,0.35)] transition hover:from-rose-600 hover:to-rose-500"
        >
          Sair
        </button>
      </aside>

      <BottomNavMobile />
    </>
  );
}

export default Header;
