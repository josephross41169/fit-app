"use client";
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import ToastHost, { showToast } from '@/components/ToastHost';
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

// ── Session self-heal helpers ───────────────────────────────────────────
// WHY: Supabase's Auth tables showed the real cause of "it keeps making me
// sign back in": every time the app reopened with an expired access token,
// the token refresh SUCCEEDED on the server, but the iOS WebView dropped the
// response ("Load failed" on resume). supabase-js then reported "no
// session", the app bounced to /login, and the user signed in again 3-10s
// later — 15 times in two months. Nothing was actually expired.
// Fix: if a saved session still exists, never treat a failed refresh as a
// sign-out. Retry it directly (bypassing supabase-js's 60s failure cache),
// and only log out when the server explicitly rejects the refresh token.
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function readStoredSession(): any | null {
  try {
    const k = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!k) return null;
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return v?.refresh_token ? v : null;
  } catch { return null; }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// 'dead'  → server rejected the refresh token: genuinely signed out.
// Session → recovered.
// null    → still couldn't reach the server (offline): keep the user in.
async function recoverSession(): Promise<Session | 'dead' | null> {
  const delays = [0, 1200, 2500, 4000, 6000];
  for (const d of delays) {
    if (d) await sleep(d);
    const stored = readStoredSession();
    if (!stored) return 'dead';
    try {
      const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
        body: JSON.stringify({ refresh_token: stored.refresh_token }),
      });
      if (res.ok) {
        const t = await res.json();
        const { data } = await supabase.auth.setSession({ access_token: t.access_token, refresh_token: t.refresh_token });
        if (data?.session) return data.session;
      } else if (res.status === 400 || res.status === 401 || res.status === 403) {
        // Double-check storage didn't just get a newer token from a
        // concurrent refresh before declaring the session dead.
        const now = readStoredSession();
        if (!now || now.refresh_token === stored.refresh_token) return 'dead';
      }
    } catch { /* network — retry */ }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Expose the current access token to the /api fetch wrapper
  // (lib/mobileFetchShim.ts) so server routes can verify the caller.
  if (typeof window !== 'undefined') (window as any).__liveleeAccessToken = session?.access_token ?? null;
  const [loading, setLoading] = useState(true);
  // Tracks the currently signed-in user's id without the stale-closure
  // problem inside the async auth listener. Used to tell a *real* sign-in
  // (different user / first sign-in) apart from the token-refresh and
  // tab-focus events Supabase re-fires for the SAME user — so we don't
  // needlessly re-set `user` and re-fetch the profile (which makes the whole
  // app look like it reloaded every time you switch tabs).
  const userIdRef = useRef<string | null>(null);

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
    // ── Hold the branded splash until first real paint ──
    // capacitor.config sets launchAutoHide:false, so the Livelee splash
    // stays up while the WebView boots instead of dropping to a black gap
    // after a fixed timer. We hide it after the first two animation frames
    // (≈ first painted frame), with an 8s failsafe so it can never stick.
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      const hideSplash = async () => { try { const m = await import('@capacitor/splash-screen'); await m.SplashScreen.hide(); } catch {} };
      const failsafe = setTimeout(hideSplash, 8000);
      requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(failsafe); hideSplash(); }));
    }

    // ── Replace native alert() with branded toasts, app-wide ──
    // ~93 call sites use alert(); routing them through the toast system here
    // upgrades every one (and any future ones) without touching call sites.
    if (typeof window !== 'undefined') {
      const nativeAlert = window.alert.bind(window);
      window.alert = (msg?: any) => {
        try { showToast(String(msg ?? '')); } catch { nativeAlert(msg); }
      };
    }

    let mounted = true;

    // ── Initial session load ───────────────────────────────────────────
    // Reads from localStorage on web, Capacitor Preferences on native.
    // No session AND nothing saved = logged out. No session but a saved
    // session exists = a failed refresh (see recoverSession) — heal it.
    let recoveryInFlight = false;
    function applySession(s: Session) {
      setSession(s);
      setLoading(false);
      if (userIdRef.current !== s.user.id) {
        userIdRef.current = s.user.id;
        setUser(s.user);
        fetchProfile(s.user).then(withProfile => { if (mounted) setUser(withProfile); });
      }
    }
    function signedOutLocally() {
      userIdRef.current = null;
      setUser(null);
      setSession(null);
      setLoading(false);
    }
    async function heal() {
      if (recoveryInFlight) return;
      recoveryInFlight = true;
      try {
        const r = await recoverSession();
        if (!mounted) return;
        if (r === 'dead') { signedOutLocally(); return; }
        if (r) { applySession(r); return; }
        // Offline: keep the user in with their saved identity; the next
        // foreground / online event retries.
        const stored = readStoredSession();
        if (stored?.user) {
          if (userIdRef.current !== stored.user.id) {
            userIdRef.current = stored.user.id;
            setUser(stored.user);
            fetchProfile(stored.user).then(withProfile => { if (mounted) setUser(withProfile); });
          }
          setLoading(false);
        } else {
          signedOutLocally();
        }
      } finally {
        recoveryInFlight = false;
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) { applySession(session); return; }
      if (readStoredSession()) { heal(); return; }
      signedOutLocally();
    }).catch(() => {
      if (!mounted) return;
      if (readStoredSession()) heal(); else setLoading(false);
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
        userIdRef.current = null;
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }

      // Have a session — happy path.
      if (newSession?.user) {
        // Always mirror the latest session (the token may have rotated).
        setSession(newSession);
        setLoading(false);
        // BUT only re-set `user` + re-fetch the profile when the signed-in
        // user actually CHANGED (a genuine new sign-in). Supabase re-fires
        // SIGNED_IN / TOKEN_REFRESHED for the SAME user on token refresh and
        // every time the tab regains focus — re-setting `user` there hands
        // every component a new object reference and re-runs fetchProfile,
        // which cascades a full re-render + data refetch (the "reloads on
        // tab switch" the user noticed). Same id ⇒ no-op for `user`.
        if (userIdRef.current !== newSession.user.id) {
          userIdRef.current = newSession.user.id;
          setUser(newSession.user);
          fetchProfile(newSession.user).then(withProfile => { if (mounted) setUser(withProfile); });
        }
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
        // BUT if a saved session exists, the boot-time refresh just failed
        // (the re-login bug) — heal instead of dropping to the login screen.
        if (readStoredSession()) { heal(); return; }
        setLoading(false);
        return;
      }

      // For TOKEN_REFRESHED / USER_UPDATED / etc with no session: a
      // refresh hiccup, not a sign-out. Heal it (only logs out if the
      // server truly rejects the saved refresh token).
      if (readStoredSession()) heal(); else signedOutLocally();
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
        const sess = data?.session;
        if (!sess) { if (readStoredSession()) heal(); return; }
        // Only force a refresh when the access token is actually near (or
        // past) expiry. Refreshing on EVERY tab focus is what made the app
        // re-fetch and feel like it reloaded each time you came back — and
        // supabase-js already auto-refreshes on its own schedule, so the
        // common case (token still valid) needs nothing here.
        const expSec = (sess as any).expires_at as number | undefined;
        if (!expSec) return;
        const secondsLeft = expSec - Math.floor(Date.now() / 1000);
        if (secondsLeft > 120) return; // still valid for >2 min — leave it alone
        // Best-effort. If the refresh returns a session, the
        // onAuthStateChange listener above will update state (and only
        // re-set `user` if the id changed). If it fails, we keep the
        // existing session — user can still browse.
        supabase.auth.refreshSession().catch(() => {});
      }).catch(() => {});
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
      // Also on pageshow — iOS fires this when bfcache restores
      window.addEventListener('pageshow', onVisible);
      window.addEventListener('online', onVisible);
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('pageshow', onVisible);
        window.removeEventListener('online', onVisible);
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
      <ToastHost />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

