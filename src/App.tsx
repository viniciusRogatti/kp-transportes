import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import GlobalAlertHost from './components/ui/GlobalAlertHost';
import useAppVersionAutoRefresh from './hooks/useAppVersionAutoRefresh';
import { RealtimeNotificationsProvider } from './providers/RealtimeNotificationsProvider';
import {
  getDefaultRouteByPermission,
  getRoutePermissions,
} from './utils/permissions';
import axios from 'axios';
import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isAuthenticationError, redirectToLoginBecauseSessionExpired } from './utils/authErrorHandler';
import useSessionInactivityLogout from './hooks/useSessionInactivityLogout';
import { clearLocalSession } from './utils/logoutSession';
import { TutorialProvider } from './tutorial/TutorialContext';

const Home = lazy(() => import('./pages/Home'));
const TodayInvoices = lazy(() => import('./pages/TodayInvoices'));
const Products = lazy(() => import('./pages/Products'));
const Customers = lazy(() => import('./pages/Customers'));
const RoutePlanning = lazy(() => import('./pages/RoutePlanning'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceJourney = lazy(() => import('./pages/InvoiceJourney'));
const FileUploadPage = lazy(() => import('./pages/FileUploadPage'));
const ReturnsOccurrences = lazy(() => import('./pages/ReturnsOccurrences'));
const ReturnDataRegistry = lazy(() => import('./pages/ReturnDataRegistry'));
const ControlTowerCollections = lazy(() => import('./pages/ControlTowerCollections'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const UserSessions = lazy(() => import('./pages/UserSessions'));
const WhatsappBotConnection = lazy(() => import('./pages/WhatsappBotConnection'));
const AlertsPage = lazy(() => import('./pages/Alerts'));
const DeliveryMonitoring = lazy(() => import('./pages/DeliveryMonitoring'));
const OperationalPendencies = lazy(() => import('./pages/OperationalPendencies'));
const CteManagement = lazy(() => import('./pages/CteManagement'));
const ReceiptBagClosing = lazy(() => import('./pages/ReceiptBagClosing'));

function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface text-sm font-semibold text-muted">
      Carregando página...
    </div>
  );
}

function ProtectedRoute({ allowedPermissions, children }: { allowedPermissions: string[]; children: JSX.Element }) {
  const token = localStorage.getItem('token');
  const permission = localStorage.getItem('user_permission') || '';

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (!allowedPermissions.includes(permission)) {
    return <Navigate to={getDefaultRouteByPermission(permission)} replace />;
  }

  return children;
}

function App() {
  useAppVersionAutoRefresh();
  useSessionInactivityLogout();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const isLoginRoute = location.pathname === '/';
  const isControlTowerRoute = location.pathname.startsWith('/control-tower');
  const realtimeToken = isLoginRoute ? null : token;

  useEffect(() => {
    const syncAuthorizationHeader = () => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        axios.defaults.headers.common.Authorization = `Bearer ${currentToken}`;
      } else {
        delete axios.defaults.headers.common.Authorization;
      }
    };

    syncAuthorizationHeader();

    const requestInterceptorId = axios.interceptors.request.use((config) => {
      const currentToken = localStorage.getItem('token');
      const headers = config.headers ?? {};
      const explicitAuthorization = headers.Authorization || headers.authorization;

      if (explicitAuthorization) {
        config.headers = headers;
        return config;
      }

      if (currentToken) {
        headers.Authorization = `Bearer ${currentToken}`;
      } else if ('Authorization' in headers) {
        delete headers.Authorization;
      } else if ('authorization' in headers) {
        delete headers.authorization;
      }

      config.headers = headers;
      return config;
    });

    const responseInterceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (isAuthenticationError(error)) {
          if (window.location.hash === '#/' || window.location.hash === '') {
            clearLocalSession();
            return Promise.reject(error);
          }

          redirectToLoginBecauseSessionExpired();
        }
        return Promise.reject(error);
      },
    );

    window.addEventListener('storage', syncAuthorizationHeader);
    window.addEventListener('focus', syncAuthorizationHeader);

    return () => {
      axios.interceptors.request.eject(requestInterceptorId);
      axios.interceptors.response.eject(responseInterceptorId);
      window.removeEventListener('storage', syncAuthorizationHeader);
      window.removeEventListener('focus', syncAuthorizationHeader);
    };
  }, []);

  return (
    <div className={isControlTowerRoute ? undefined : 'professional-ui'}>
      <RealtimeNotificationsProvider token={realtimeToken}>
        <TutorialProvider>
          <GlobalAlertHost />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/home')]}><Home /></ProtectedRoute>} />
          <Route path="/todayInvoices" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/todayInvoices')]}><TodayInvoices /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/invoices')]}><Invoices /></ProtectedRoute>} />
          <Route path="/invoice-journey" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/invoice-journey')]}><InvoiceJourney /></ProtectedRoute>} />
          <Route path="/invoices/:invoiceNumber/journey" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/invoices/:invoiceNumber/journey')]}><InvoiceJourney /></ProtectedRoute>} />
          <Route path="/operational-pendencies" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/operational-pendencies')]}><OperationalPendencies /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/alerts')]}><AlertsPage /></ProtectedRoute>} />
          <Route path="/delivery-monitoring" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/delivery-monitoring')]}><DeliveryMonitoring /></ProtectedRoute>} />
          <Route path="/receipt-bag-closing" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/receipt-bag-closing')]}><ReceiptBagClosing /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/products')]}><Products /></ProtectedRoute>} />
          <Route path="/routePlanning" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/routePlanning')]}><RoutePlanning /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/customers')]}><Customers /></ProtectedRoute>} />
          <Route path="/trips" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/trips')]}><RoutePlanning /></ProtectedRoute>} />
          <Route path="/uploadFiles" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/uploadFiles')]}><FileUploadPage /></ProtectedRoute>} />
          <Route path="/cte-management" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/cte-management')]}><CteManagement /></ProtectedRoute>} />
          <Route path="/returns-occurrences" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/returns-occurrences')]}><ReturnsOccurrences /></ProtectedRoute>} />
          <Route path="/returns-occurrences/base" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/returns-occurrences/base')]}><ReturnDataRegistry /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/users')]}><UserManagement /></ProtectedRoute>} />
          <Route path="/user-sessions" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/user-sessions')]}><UserSessions /></ProtectedRoute>} />
          <Route path="/whatsapp-bot/connect" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/whatsapp-bot/connect')]}><WhatsappBotConnection /></ProtectedRoute>} />
          <Route path="/control-tower/coletas" element={<ProtectedRoute allowedPermissions={[...getRoutePermissions('/control-tower/coletas')]}><ControlTowerCollections /></ProtectedRoute>} />
          <Route path="*" element={<Login />} />
            </Routes>
          </Suspense>
        </TutorialProvider>
      </RealtimeNotificationsProvider>
    </div>
  );
}

export default App;
