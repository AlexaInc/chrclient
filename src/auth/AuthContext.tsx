import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { SERVER_URL } from '../config';
import { connectSocket, disconnectSocket } from '../scripts/Websocket';

export interface AuthUser {
  username: string;
  role?: string;
  [key: string]: any;
}

interface AuthContextValue {
  /** null until a successful login — app starts UNAUTHORIZED */
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  loginError: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      // Same server URL as the websocket (universally bound backend)
      const res = await fetch(`${SERVER_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const msg =
          res.status === 401 || res.status === 403
            ? 'Invalid username or password'
            : `Login failed (${res.status})`;
        setLoginError(msg);
        return false;
      }

      const data = await res.json();
      // Accept common token field names from the backend
      const receivedToken: string | undefined =
        data.token ?? data.accessToken ?? data.access_token ?? data.jwt;

      if (!receivedToken) {
        setLoginError('Login response did not include a token');
        return false;
      }

      setToken(receivedToken);
      setUser(data.user ?? { username, role: data.role });

      // Only NOW connect the websocket — never before login
      connectSocket(SERVER_URL, receivedToken);
      return true;
    } catch (e: any) {
      setLoginError(e?.message ?? 'Network error — cannot reach server');
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    disconnectSocket();
    setUser(null);
    setToken(null);
    setLoginError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: user !== null && token !== null,
      isLoggingIn,
      loginError,
      login,
      logout,
    }),
    [user, token, isLoggingIn, loginError, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
