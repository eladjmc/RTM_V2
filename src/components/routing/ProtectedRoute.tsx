import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import FullPageSpinner from '../common/FullPageSpinner';

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}
