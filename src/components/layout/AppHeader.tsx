import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Button,
  Box,
} from '@mui/material';
import {
  Menu as MenuIcon,
  DarkMode,
  LightMode,
  Headphones,
  MenuBook,
  Logout,
  SkipNext,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useAuth } from '../../hooks/useAuth';

interface AppHeaderProps {
  onMenuClick: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMenuClick }) => {
  const [themeMode, setThemeMode] = useLocalStorage<'light' | 'dark'>(
    'rtm-theme',
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const [autoNext, setAutoNext] = useLocalStorage('rtm-auto-next-chapter', true);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const isLibrary = location.pathname.startsWith('/library');

  return (
    <AppBar position="sticky" color="default" elevation={1}>
      <Toolbar variant="dense" sx={{ justifyContent: 'space-between' }}>
        <Typography
          variant="h6"
          component="h1"
          sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}
        >
          RTM
        </Typography>

        {/* Desktop nav links — hidden on xs */}
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ display: { xs: 'none', sm: 'flex' } }}
        >
          <Button
            size="small"
            startIcon={<Headphones />}
            onClick={() => navigate('/')}
            variant={!isLibrary ? 'contained' : 'text'}
            color={!isLibrary ? 'primary' : 'inherit'}
            disableElevation
            sx={{ textTransform: 'none', fontWeight: !isLibrary ? 700 : 400 }}
          >
            Reader
          </Button>
          <Button
            size="small"
            startIcon={<MenuBook />}
            onClick={() => navigate('/library')}
            variant={isLibrary ? 'contained' : 'text'}
            color={isLibrary ? 'primary' : 'inherit'}
            disableElevation
            sx={{ textTransform: 'none', fontWeight: isLibrary ? 700 : 400 }}
          >
            Library
          </Button>

          <Box sx={{ width: 8 }} />

          <Tooltip title={autoNext ? 'Auto-next chapter: ON' : 'Auto-next chapter: OFF'}>
            <IconButton
              size="small"
              onClick={() => setAutoNext((p) => !p)}
              aria-label="Toggle auto-next chapter"
              color={autoNext ? 'primary' : 'default'}
            >
              <SkipNext fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={themeMode === 'light' ? 'Dark mode' : 'Light mode'}>
            <IconButton
              size="small"
              onClick={() => setThemeMode((p) => (p === 'light' ? 'dark' : 'light'))}
              aria-label="Toggle theme"
            >
              {themeMode === 'light' ? <DarkMode fontSize="small" /> : <LightMode fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Logout">
            <IconButton
              size="small"
              onClick={logout}
              aria-label="Logout"
              sx={{ color: 'error.main' }}
            >
              <Logout fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Mobile: theme toggle + hamburger — hidden on sm+ */}
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ display: { xs: 'flex', sm: 'none' } }}
        >
          <Tooltip title={themeMode === 'light' ? 'Dark mode' : 'Light mode'}>
            <IconButton
              onClick={() => setThemeMode((p) => (p === 'light' ? 'dark' : 'light'))}
              aria-label="Toggle theme"
            >
              {themeMode === 'light' ? <DarkMode /> : <LightMode />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Menu">
            <IconButton onClick={onMenuClick} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
