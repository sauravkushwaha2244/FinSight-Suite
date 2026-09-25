'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  signInWithGoogle: async () => {},
  signOut: () => Promise.resolve(),
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const initAuth = useCallback(async () => {
    try {
      // 1. Check local storage token
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('finsight_token') : null;
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('finsight_user') : null;

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setSession({ access_token: storedToken, user: parsedUser });
          setLoading(false);
          return;
        } catch (e) {
          localStorage.removeItem('finsight_user');
          localStorage.removeItem('finsight_token');
        }
      }

      // 2. Check Supabase session as fallback
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          return;
        }
      } catch (err) {
        // Supabase not reachable
      }

      // 3. Not authenticated
      setUser(null);
      setSession(null);
      if (pathname !== '/login' && pathname !== '/') {
        router.push('/login');
      }
    } catch (err) {
      console.warn('Auth initialization error:', err);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed. Please check your credentials.');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('finsight_token', data.access_token);
        localStorage.setItem('finsight_user', JSON.stringify(data.user));
        localStorage.removeItem('finsight_demo_mode');
      }

      setUser(data.user);
      setSession({ access_token: data.access_token, user: data.user });
      router.push('/dashboard');
      return data;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, fullName) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role: 'admin',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed.');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('finsight_token', data.access_token);
        localStorage.setItem('finsight_user', JSON.stringify(data.user));
        localStorage.removeItem('finsight_demo_mode');
      }

      setUser(data.user);
      setSession({ access_token: data.access_token, user: data.user });
      router.push('/dashboard');
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        throw error;
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('finsight_token');
      localStorage.removeItem('finsight_user');
      localStorage.removeItem('finsight_demo_mode');
    }
    setUser(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      /* ignore */
    }
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isDemo: false, login, register, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
