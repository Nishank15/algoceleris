import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  authLogin,
  authSignup,
  authRefresh,
  authLogout,
  setAccessToken,
  AuthUserResponse,
} from '../services/api';

export interface User {
  id: string;
  username: string;
  email: string;
  tier: 'free' | 'pro' | 'admin';
  isGuest: boolean;
  college_name?: string | null;
  avatar_url?: string | null;
}

export interface AuthContextType {
  user: User;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string, college_name?: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void> | void;
  setTier: (tier: 'free' | 'pro' | 'admin') => void;
}

const GUEST_USER: User = {
  id: 'guest-usr',
  username: 'Guest',
  email: 'guest@cloudjudge.dev',
  tier: 'free',
  isGuest: true,
};

const mapAuthUser = (res: AuthUserResponse): User => ({
  id: res.id,
  username: res.username,
  email: res.email,
  tier: (res.account_type as 'free' | 'pro' | 'admin') || 'free',
  isGuest: false,
  college_name: res.college_name,
  avatar_url: res.avatar_url,
});

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(GUEST_USER);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Silent session restore on mount via HttpOnly cookie
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const tokenRes = await authRefresh();
        if (isMounted && tokenRes?.user) {
          setUser(mapAuthUser(tokenRes.user));
        }
      } catch {
        // No active session or unauthenticated; remain in Guest mode
        if (isMounted) {
          setUser(GUEST_USER);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authLogin(email.trim(), password);
    if (res?.user) {
      setUser(mapAuthUser(res.user));
    }
  }, []);

  const signup = useCallback(async (username: string, email: string, password: string, college_name?: string) => {
    const res = await authSignup({
      username: username.trim(),
      email: email.trim(),
      password,
      college_name,
    });
    if (res?.user) {
      setUser(mapAuthUser(res.user));
    }
  }, []);

  const loginAsGuest = useCallback(() => {
    setAccessToken(null);
    setUser(GUEST_USER);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authLogout();
    } finally {
      setAccessToken(null);
      setUser(GUEST_USER);
    }
  }, []);

  const setTier = useCallback((tier: 'free' | 'pro' | 'admin') => {
    setUser((prev) => ({ ...prev, tier }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        loginAsGuest,
        logout,
        setTier,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
