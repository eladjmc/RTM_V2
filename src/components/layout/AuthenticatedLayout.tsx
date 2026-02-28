import { useState } from 'react';
import { Outlet } from 'react-router';
import AppHeader from './AppHeader';
import NavDrawer from './NavDrawer';
import { useAutoMount } from '../../hooks/useAutoMount';

export default function AuthenticatedLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-mount last read chapter on app load
  useAutoMount();

  return (
    <>
      <AppHeader onMenuClick={() => setDrawerOpen(true)} />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Outlet />
    </>
  );
}
