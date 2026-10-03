import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  username: string;
  email: string;
  tier: 'free' | 'pro';
  isGuest: boolean;
}

export interface AuthContextType {
  user: User;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => void;
  setTier: (tier: 'free' | 'pro') => void;
}

const GUEST_USER: User = {
  id: 'guest-usr',
  username: 'Guest',
  email: 'guest@cloudjudge.dev',
  tier: 'free',
  isGuest: true,
};

const STORAGE_KEY = 'cloud_judge_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (err) {
        console.warn('Failed to parse stored user, defaulting to guest:', err);
      }
    }
    return GUEST_USER;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('Failed to persist user session:', err);
    }
  }, [user]);

  const login = useCallback(async (email: string, _password: string) => {
    // Client-side authentication simulation with persistence
    const extractedUsername = email.split('@')[0] || 'developer';
    const authenticatedUser: User = {
      id: `usr-${Date.now()}`,
      username: extractedUsername,
      email,
      tier: 'free',
      isGuest: false,
    };
    setUser(authenticatedUser);
  }, []);

  const signup = useCallback(async (username: string, email: string, _password: string) => {
    const newUser: User = {
      id: `usr-${Date.now()}`,
      username: username.trim(),
      email,
      tier: 'free',
      isGuest: false,
    };
    setUser(newUser);
  }, []);

  const loginAsGuest = useCallback(() => {
    setUser(GUEST_USER);
  }, []);

  const logout = useCallback(() => {
    setUser(GUEST_USER);
  }, []);

  const setTier = useCallback((tier: 'free' | 'pro') => {
    setUser((prev) => ({ ...prev, tier }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
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
