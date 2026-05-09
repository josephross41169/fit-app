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
    // Account type — personal | business. Critical for many UI branches
    // (profile layout, bottom nav, onboarding redirect, route guards).
    account_type?: 'personal' | 'business' | null;
    // Business-only fields — only populated when account_type = 'business'.
    // All nullable since new columns didn't exist for older rows.
    business_name?: string | null;
    business_type?: string | null;
    business_website?: string | null;
    business_address?: string | null;
    business_phone?: string | null;
    business_email?: string | null;
    business_hours?: any;
    business_description_long?: string | null;
    business_instagram?: string | null;
    business_tiktok?: string | null;
    business_twitter?: string | null;
    business_youtube?: string | null;
    verification_status?: string | null;
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
      // Pull everything the app might need from the users row in one query.
      // account_type is critical — without it every business/personal branch
      // in the UI silently falls through to the personal layout.
      const { data } = await supabase
        .from('users')
        .select('*')
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
    let mounted = true;
    let recoveryInFlight = false;

    // ── Initial session load ───────────────────────────────────────────
    // Reads from localStorage on web, Capacitor Preferences on native.
    // Failing here = no persisted session, treat as logged out.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        setUser(session.user);
        setLoading(false);
        fetchProfile(session.user).then(withProfile => { if (mounted) setUser(withProfile); });
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    // ── onAuthStateChange — be defensive about iOS PWA flakiness ──────
    // The previous handler wiped `user` on every null-session event,
    // which kicked iOS PWA users back to the login screen anytime the
    // WebView suspended/resumed during an upload (the user reported
    // this happening 4 times in a row while posting wellness).
    //
    // Supabase fires this for: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
    // USER_UPDATED, PASSWORD_RECOVERY, INITIAL_SESSION.
    //
    // Rules now:
    //   • SIGNED_OUT (explicit): clear user. The user actually signed out.
    //   • TOKEN_REFRESHED + session present: update normally.
    //   • TOKEN_REFRESHED + no session: a refresh failure (network blip on
    //     PWA wake). DO NOT clear user — try to recover.
    //   • Any other event with a session: update normally.
    //   • INITIAL_SESSION + no session: first load, no persisted auth —
    //     not really a state change but we set loading=false below.
    //
    // The recovery path: if we land in a "supposedly signed in but no
    // session" state, kick a manual refresh once. If THAT fails too,
    // accept the sign-out and clear. This converts a transient blip
    // (the common case on iOS PWA wake) into a no-op while still
    // honoring real session expiry.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      // Real sign-out — honor it.
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }

      // Have a session — happy path. Mirror it into state.
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        setLoading(false);
        fetchProfile(newSession.user).then(withProfile => { if (mounted) setUser(withProfile); });
        return;
      }

      // No session, but the event isn't SIGNED_OUT. This is the iOS PWA
      // failure mode. If we currently believe the user is signed in,
      // try a one-shot manual refresh before clearing.
      // (We use a ref-style flag because the user state we'd otherwise
      // close over is stale inside this async listener.)
      if (event === 'INITIAL_SESSION') {
        // First load with no persisted session — definitely logged out.
        // (Real users still get the sign-in screen here on first visit;
        // just don't loop.)
        setLoading(false);
        return;
      }

      // For TOKEN_REFRESHED / USER_UPDATED / etc with no session: probe
      // with a refresh. Avoid stacking concurrent refreshes when iOS
      // resume fires a flurry of events.
      if (recoveryInFlight) return;
      recoveryInFlight = true;
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!mounted) return;
        if (refreshed?.session?.user) {
          // Recovered. Don't sign them out.
          setSession(refreshed.session);
          setUser(refreshed.session.user);
          setLoading(false);
          fetchProfile(refreshed.session.user).then(withProfile => { if (mounted) setUser(withProfile); });
        } else {
          // Refresh truly failed — user is logged out for real.
          setUser(null);
          setSession(null);
          setLoading(false);
        }
      } catch {
        // Network errored on the refresh too. Don't punt the user yet —
        // the next foreground tick (visibilitychange below) will retry.
        // Keep current user/session in state.
      } finally {
        recoveryInFlight = false;
      }
    });

    // ── visibilitychange recovery ─────────────────────────────────────
    // On iOS PWA / Safari, when the page comes back to foreground after
    // the WebView was suspended, supabase-js's internal auto-refresh may
    // have already run and failed silently. Trigger an explicit refresh
    // when we regain visibility so any expired token gets renewed
    // before the user's next tap that might depend on it.
    function onVisible() {
      if (typeof document === 'undefined') return;
      if (document.visibilityState !== 'visible') return;
      // No-op if we don't think the user is signed in — nothing to refresh.
      // Use getSession (cached) rather than the user state ref to avoid
      // stale-closure issues.
      supabase.auth.getSession().then(({ data }) => {
        if (!data?.session) return;
        // Best-effort. If the refresh returns a session, the
        // onAuthStateChange listener above will update state. If it
        // fails, we keep the existing session — user can still browse.
        supabase.auth.refreshSession().catch(() => {});
      }).catch(() => {});
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
      // Also on pageshow — iOS fires this when bfcache restores
      window.addEventListener('pageshow', onVisible);
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('pageshow', onVisible);
      }
    };
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

