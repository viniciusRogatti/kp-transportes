import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import GlobalAlertHost from './components/ui/GlobalAlertHost';
import useAppVersionAutoRefresh from './hooks/useAppVersionAutoRefresh';
import { RealtimeNotificationsProvider } from './providers/RealtimeNotificationsProvider';
import {
  ADMIN_MASTER_PERMISSIONS,
  CONTROL_TOWER_PERMISSION,
  TRANSPORT_INTERNAL_PERMISSIONS,
  USER_ALLOWED_PERMISSIONS,
  getDefaultRouteByPermission,
} from './utils/permissions';
import axios from 'axios';
import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isAuthenticationError, redirectToLoginBecauseSessionExpired } from './utils/authErrorHandler';
import useSessionInactivityLogout from './hooks/useSessionInactivityLogout';
import { clearLocalSession } from './utils/logoutSession';

const Home = lazy(() => import('./pages/Home'));
const TodayInvoices = lazy(() => import('./pages/TodayInvoices'));
const Products = lazy(() => import('./pages/Products'));
const Customers = lazy(() => import('./pages/Customers'));
const RoutePlanning = lazy(() => import('./pages/RoutePlanning'));
const Invoices = lazy(() => import('./pages/Invoices'));
const FileUploadPage = lazy(() => import('./pages/FileUploadPage'));
const ReturnsOccurrences = lazy(() => import('./pages/ReturnsOccurrences'));
const ControlTowerCollections = lazy(() => import('./pages/ControlTowerCollections'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const UserSessions = lazy(() => import('./pages/UserSessions'));
const WhatsappBotConnection = lazy(() => import('./pages/WhatsappBotConnection'));
const AlertsPage = lazy(() => import('./pages/Alerts'));
const DeliveryMonitoring = lazy(() => import('./pages/DeliveryMonitoring'));
const OperationalPendencies = lazy(() => import('./pages/OperationalPendencies'));
const CteManagement = lazy(() => import('./pages/CteManagement'));

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
    <div>
      <RealtimeNotificationsProvider token={realtimeToken}>
        <GlobalAlertHost />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS]}><Home /></ProtectedRoute>} />
          <Route path="/todayInvoices" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><TodayInvoices /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><Invoices /></ProtectedRoute>} />
          <Route path="/operational-pendencies" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><OperationalPendencies /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><AlertsPage /></ProtectedRoute>} />
          <Route path="/delivery-monitoring" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS, CONTROL_TOWER_PERMISSION]}><DeliveryMonitoring /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><Products /></ProtectedRoute>} />
          <Route path="/routePlanning" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS]}><RoutePlanning /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><Customers /></ProtectedRoute>} />
          <Route path="/trips" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS]}><RoutePlanning /></ProtectedRoute>} />
          <Route path="/uploadFiles" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS]}><FileUploadPage /></ProtectedRoute>} />
          <Route path="/cte-management" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS]}><CteManagement /></ProtectedRoute>} />
          <Route path="/returns-occurrences" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS, CONTROL_TOWER_PERMISSION]}><ReturnsOccurrences /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute allowedPermissions={[...ADMIN_MASTER_PERMISSIONS]}><UserManagement /></ProtectedRoute>} />
          <Route path="/user-sessions" element={<ProtectedRoute allowedPermissions={['master']}><UserSessions /></ProtectedRoute>} />
          <Route path="/whatsapp-bot/connect" element={<ProtectedRoute allowedPermissions={['master']}><WhatsappBotConnection /></ProtectedRoute>} />
          <Route path="/control-tower/coletas" element={<ProtectedRoute allowedPermissions={[CONTROL_TOWER_PERMISSION, 'admin', 'master', 'expedicao']}><ControlTowerCollections /></ProtectedRoute>} />
          <Route path="*" element={<Login />} />
          </Routes>
        </Suspense>
      </RealtimeNotificationsProvider>
    </div>
  );
}

export default App;
