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
import GlobalAlertHost from './components/ui/GlobalAlertHost';
import useAppVersionAutoRefresh from './hooks/useAppVersionAutoRefresh';
import { RealtimeNotificationsProvider } from './providers/RealtimeNotificationsProvider';
import axios from 'axios';
// import FreightSummary from './pages/FreightCalculation';

const INTERNAL_PERMISSIONS = ['admin', 'user', 'master', 'expedicao'];

function ProtectedRoute({ allowedPermissions, children }: { allowedPermissions: string[]; children: JSX.Element }) {
  const token = localStorage.getItem('token');
  const permission = localStorage.getItem('user_permission') || '';

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (!allowedPermissions.includes(permission)) {
    if (permission === 'control_tower') {
      return <Navigate to="/control-tower/coletas" replace />;
    }

    if (INTERNAL_PERMISSIONS.includes(permission)) {
      return <Navigate to="/home" replace />;
    }

    return <Navigate to="/" replace />;
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
          <Route path="/home" element={<ProtectedRoute allowedPermissions={INTERNAL_PERMISSIONS}><Home /></ProtectedRoute>} />
          <Route path="/todayInvoices" element={<ProtectedRoute allowedPermissions={INTERNAL_PERMISSIONS}><TodayInvoices /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute allowedPermissions={INTERNAL_PERMISSIONS}><Invoices /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute allowedPermissions={INTERNAL_PERMISSIONS}><Products /></ProtectedRoute>} />
          <Route path="/routePlanning" element={<ProtectedRoute allowedPermissions={INTERNAL_PERMISSIONS}><RoutePlanning /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute allowedPermissions={INTERNAL_PERMISSIONS}><Customers /></ProtectedRoute>} />
          <Route path="/trips" element={<ProtectedRoute allowedPermissions={INTERNAL_PERMISSIONS}><RoutePlanning /></ProtectedRoute>} />
          <Route path="/uploadFiles" element={<ProtectedRoute allowedPermissions={INTERNAL_PERMISSIONS}><FileUploadPage /></ProtectedRoute>} />
          <Route path="/returns-occurrences" element={<ProtectedRoute allowedPermissions={[...INTERNAL_PERMISSIONS, 'control_tower']}><ReturnsOccurrences /></ProtectedRoute>} />
          <Route path="/control-tower/coletas" element={<ProtectedRoute allowedPermissions={['control_tower', 'admin', 'master', 'expedicao']}><ControlTowerCollections /></ProtectedRoute>} />
          <Route path="*" element={<Login />} />
        </Routes>
      </RealtimeNotificationsProvider>
    </div>
  );
}

export default App;
