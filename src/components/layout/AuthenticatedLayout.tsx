import { useState } from 'react';
import { Outlet } from 'react-router';
import { Box } from '@mui/material';
import AppHeader from './AppHeader';
import NavDrawer from './NavDrawer';
import { useAutoMount } from '../../hooks/useAutoMount';

export default function AuthenticatedLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-mount last read chapter on app load
  useAutoMount();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppHeader onMenuClick={() => setDrawerOpen(true)} />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Box
        component="main"
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
