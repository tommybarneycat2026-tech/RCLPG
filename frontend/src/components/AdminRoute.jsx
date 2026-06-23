import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function AdminRoute() {
  const { isAuthenticated, loading, isAdministrator } = useAuth();

  if (loading) return <LoadingSpinner label="Checking access" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdministrator) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
