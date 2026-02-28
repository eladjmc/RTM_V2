import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import api from '../services/api';
import { AuthContext, type AuthContextValue } from './authContextDef';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  loading: boolean;
}

export type { AuthContextValue };

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    username: null,
    loading: true,
  });

  // Check existing session on mount
  useEffect(() => {
    api
      .get<{ username: string }>('/api/auth/me')
      .then((data) => {
        setState({ isAuthenticated: true, username: data.username, loading: false });
      })
      .catch(() => {
        setState({ isAuthenticated: false, username: null, loading: false });
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await api.post<{ message: string; username: string }>('/api/auth/login', {
      username,
      password,
    });
    setState({ isAuthenticated: true, username, loading: false });
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout', {});
    setState({ isAuthenticated: false, username: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
