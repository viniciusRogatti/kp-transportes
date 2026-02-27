import Home from './pages/Home';
import { Routes, Route, Navigate } from 'react-router-dom';
import TodayInvoices from './pages/TodayInvoices';
import Products from './pages/Products';
import Customers from './pages/Customers';
import RoutePlanning from './pages/RoutePlanning';
import Invoices from './pages/Invoices';
import FileUploadPage from './pages/FileUploadPage';
import Login from './pages/Login';
import ReturnsOccurrences from './pages/ReturnsOccurrences';
import ControlTowerCollections from './pages/ControlTowerCollections';
import UserManagement from './pages/UserManagement';
import UserSessions from './pages/UserSessions';
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
// import FreightSummary from './pages/FreightCalculation';

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
  const token = localStorage.getItem('token');
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }

  return (
    <div>
      <RealtimeNotificationsProvider token={token}>
        <GlobalAlertHost />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS]}><Home /></ProtectedRoute>} />
          <Route path="/todayInvoices" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><TodayInvoices /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><Invoices /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><Products /></ProtectedRoute>} />
          <Route path="/routePlanning" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS]}><RoutePlanning /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute allowedPermissions={[...USER_ALLOWED_PERMISSIONS]}><Customers /></ProtectedRoute>} />
          <Route path="/trips" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS]}><RoutePlanning /></ProtectedRoute>} />
          <Route path="/uploadFiles" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS]}><FileUploadPage /></ProtectedRoute>} />
          <Route path="/returns-occurrences" element={<ProtectedRoute allowedPermissions={[...TRANSPORT_INTERNAL_PERMISSIONS, CONTROL_TOWER_PERMISSION]}><ReturnsOccurrences /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute allowedPermissions={[...ADMIN_MASTER_PERMISSIONS]}><UserManagement /></ProtectedRoute>} />
          <Route path="/user-sessions" element={<ProtectedRoute allowedPermissions={['master']}><UserSessions /></ProtectedRoute>} />
          <Route path="/control-tower/coletas" element={<ProtectedRoute allowedPermissions={[CONTROL_TOWER_PERMISSION, 'admin', 'master', 'expedicao']}><ControlTowerCollections /></ProtectedRoute>} />
          <Route path="*" element={<Login />} />
        </Routes>
      </RealtimeNotificationsProvider>
    </div>
  );
}

export default App;
