import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileArchive,
  Home,
  Menu,
  Route,
  Search,
  Truck,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { API_URL } from '../data';
import BottomNavMobile from './layout/BottomNavMobile';

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: JSX.Element;
};

const navItems: NavItem[] = [
  { to: '/home', label: 'Home', shortLabel: 'Home', icon: <Home className="h-4 w-4" /> },
  { to: '/todayInvoices', label: 'Notas do Dia', shortLabel: 'Hoje', icon: <CalendarDays className="h-4 w-4" /> },
  { to: '/invoices', label: 'Pesquisar Notas', shortLabel: 'Notas', icon: <Search className="h-4 w-4" /> },
  { to: '/products', label: 'Itens Cadastrados', shortLabel: 'Itens', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/customers', label: 'Clientes', shortLabel: 'Clientes', icon: <Users className="h-4 w-4" /> },
  { to: '/routePlanning', label: 'Roteirização', shortLabel: 'Rotas', icon: <Route className="h-4 w-4" /> },
  { to: '/trips', label: 'Trips', shortLabel: 'Trips', icon: <Truck className="h-4 w-4" /> },
  { to: '/returns-occurrences', label: 'Devolução/Ocorrência', shortLabel: 'Dev/Ocorr', icon: <FileArchive className="h-4 w-4" /> },
  { to: '/uploadFiles', label: 'Enviar XML', shortLabel: 'XML', icon: <Upload className="h-4 w-4" /> },
];

const routeTitles: Record<string, string> = {
  '/home': 'Painel Operacional',
  '/todayInvoices': 'Notas do Dia',
  '/invoices': 'Pesquisar Notas',
  '/products': 'Itens Cadastrados',
  '/customers': 'Clientes',
  '/routePlanning': 'Roteirização',
  '/trips': 'Trips',
  '/returns-occurrences': 'Devoluções e Ocorrências',
  '/uploadFiles': 'Envio de XML',
  '/control-tower/coletas': 'Torre de Controle',
};

function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [quickSearch, setQuickSearch] = useState('');
  const desktopSidebarRef = useRef<HTMLElement | null>(null);
  const topbarRef = useRef<HTMLElement | null>(null);

  const currentTitle = routeTitles[location.pathname] || 'KP Transportes';
  const currentSection = location.pathname.startsWith('/control-tower') ? 'Control Tower' : 'Operação';
  const permission = localStorage.getItem('user_permission') || 'user';

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
    const token = localStorage.getItem('token');
    if (!token) return;

    const loadPending = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/occurrences/search?status=pending`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPendingCount(Array.isArray(data) ? data.length : 0);
      } catch {
        setPendingCount(0);
      }
    };

    loadPending();
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

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user_permission');
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
          'fixed left-0 top-0 z-[1200] hidden h-screen border-r border-border bg-[linear-gradient(180deg,rgba(12,23,40,0.94)_0%,rgba(8,16,30,0.96)_100%)] px-3 py-3 shadow-[var(--shadow-2)] backdrop-blur md:flex md:flex-col md:transition-[width] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)]',
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
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'group flex items-center rounded-md border py-2 text-sm transition',
                  isSidebarCollapsed ? 'justify-center px-1' : 'gap-2 px-2.5',
                  isActive
                    ? 'border-sky-700/70 bg-sky-900/30 text-sky-100'
                    : 'border-transparent text-muted hover:border-border hover:bg-surface/70 hover:text-text',
                )}
                title={item.label}
              >
                <span className={cn(
                  'inline-flex items-center justify-center rounded-md border border-border bg-surface-2',
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
          className="mt-2 inline-flex h-10 items-center justify-center rounded-md border border-rose-800/70 bg-rose-950/35 px-3 text-sm font-medium text-rose-200 hover:bg-rose-900/45"
        >
          {isSidebarCollapsed ? 'Sair' : 'Sair da sessão'}
        </button>
      </aside>

      <header ref={topbarRef} className="fixed left-0 right-0 top-0 z-[1100] h-[var(--header-height)] border-b border-border bg-[rgba(6,13,25,0.86)] px-3 backdrop-blur-xl md:left-[var(--app-sidebar-current)] md:px-4 md:transition-[left] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)]">
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
            <button
              type="button"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface/80 text-text"
              aria-label="Abrir notificações"
            >
              <Bell className="h-4 w-4" />
              {pendingCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              ) : null}
            </button>
            <div className="hidden items-center gap-2 rounded-md border border-border bg-surface/80 px-2 py-1.5 md:flex">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2">
                <User className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-muted">Usuário</p>
                <p className="text-sm font-medium text-text">{permission}</p>
              </div>
            </div>
          </div>
        </div>

        {isNotificationOpen ? (
          <div className="absolute right-3 top-[calc(var(--header-height)+8px)] z-[1200] w-[min(92vw,320px)] rounded-md border border-border bg-surface p-3 shadow-[var(--shadow-3)] md:right-4">
            <h3 className="mb-1 text-sm font-semibold text-text">Pendências</h3>
            <p className="text-xs text-muted">Ocorrências pendentes no momento</p>
            <p className="mt-2 text-2xl font-semibold text-text">{pendingCount}</p>
            <p className="mt-1 text-xs text-muted">Use esse número para priorizar a operação diária.</p>
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
          'fixed left-0 top-0 z-[1200] h-dvh w-[min(85vw,320px)] border-r border-border bg-[linear-gradient(180deg,rgba(12,23,40,0.97)_0%,rgba(8,16,30,0.98)_100%)] p-3 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden',
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

        <nav className="scrollbar-ui space-y-1 overflow-auto pb-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm',
                  isActive ? 'border-sky-700/70 bg-sky-900/30 text-sky-100' : 'border-transparent text-muted',
                )}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2">
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
          className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md border border-rose-800/70 bg-rose-950/35 text-sm font-medium text-rose-200"
        >
          Sair
        </button>
      </aside>

      <BottomNavMobile />
    </>
  );
}

export default Header;
