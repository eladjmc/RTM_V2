import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';

import { lightTheme, darkTheme } from '../theme';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { AuthProvider } from '../context/AuthContext';

export default function AppProviders({ children }: { children: ReactNode }) {
  const [themeMode] = useLocalStorage<'light' | 'dark'>(
    'rtm-theme',
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            bgcolor: 'background.default',
          }}
        >
          <AuthProvider>{children}</AuthProvider>
        </Box>
      </ThemeProvider>
    </BrowserRouter>
  );
}
