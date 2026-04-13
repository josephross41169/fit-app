"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthUser extends User {
  profile?: {
    username: string;
    full_name: string;
    bio: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    followers_count: number;
    following_count: number;
    posts_count: number;
  }
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(authUser: User): Promise<AuthUser> {
    try {
      const { data } = await supabase
        .from('users')
        .select('username, full_name, bio, avatar_url, banner_url, followers_count, following_count, posts_count')
        .eq('id', authUser.id)
        .single();
      return { ...authUser, profile: data || undefined };
    } catch {
      return authUser;
    }
  }

  async function refreshProfile() {
    if (!user) return;
    const updated = await fetchProfile(user);
    setUser(updated);
  }

  useEffect(() => {
    // Get the current session — this reads from localStorage, should be instant
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        // IMMEDIATELY set the user so the app doesn't redirect to login
        // Then load profile in background without blocking
        setUser(session.user);
        setLoading(false);
        // Load profile in background — updates user silently
        fetchProfile(session.user).then(withProfile => setUser(withProfile));
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        // Same pattern — set user immediately, profile loads in background
        setUser(session.user);
        setLoading(false);
        fetchProfile(session.user).then(withProfile => setUser(withProfile));
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, username: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: fullName } },
    });
    return { error: error as Error | null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

