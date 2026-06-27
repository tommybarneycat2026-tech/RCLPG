import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import SalesLogPage from './pages/SalesLogPage';
import CreditLogsPage from './pages/CreditLogsPage';
import AdminProfilePage from './pages/AdminProfilePage';
import RCLPGLogo from '../RCLPG_Logo.jpg';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/sales-log" element={<SalesLogPage />} />
              <Route path="/credit-logs" element={<CreditLogsPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin/profile" element={<AdminProfilePage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
