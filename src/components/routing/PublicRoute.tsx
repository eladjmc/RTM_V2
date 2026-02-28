import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import FullPageSpinner from '../common/FullPageSpinner';

export default function PublicRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to="/" replace />;

  return <Outlet />;
}
