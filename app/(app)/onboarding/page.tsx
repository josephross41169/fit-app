"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { isBusinessAccount } from "@/lib/businessTypes";
import {
  isHealthKitAvailable,
  requestHealthKitPermissions,
  runHealthKitSync,
} from "@/lib/healthkit";
import { getFitbitAuthURL } from "@/lib/fitbit";

// ─────────────────────────────────────────────────────────────────────────────
// New-user onboarding.
//
// Deliberately NOT a fitness-program questionnaire (goal / macros / equipment) —
// that intake never matched what people actually do in Livelee, and program
// details are asked in-context inside the AI planner instead. This flow only
// covers what maps to the app on day one: who you are, and who you're with.
//
//   0 Welcome   → what Livelee is
//   1 Profile   → photo, banner, name, bio (live preview)
//   2 Sync      → Apple Health (iPhone) / Fitbit (when configured) — optional
//   3 People    → follow a few suggested athletes
//   4 Groups    → join a few popular groups
//   5 Done      → commit everything, drop into the feed
//
// Every step is skippable. Nothing is written until the final "Jump into
// Livelee" (or the welcome "Skip for now"), so users can toggle freely without
// needing unfollow / leave actions mid-flow.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  purple: "#5BBE93",
  purpleDark: "#3E9E74",
  purpleSoft: "#86CFAE",
  purpleGhost: "rgba(124,58,237,0.14)",
  gold: "#F5A623",
  green: "#22C55E",
  teal: "#00B0B9",
  text: "#F2F2F4",
  sub: "#9CA3AF",
  dim: "#6B7280",
  bg: "#0E1311",
  card: "#121212",
  card2: "#17171F",
  raised: "#1C1B26",
  border: "#232030",
  border2: "#2C2838",
};

type SuggestedUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  followers_count: number | null;
};

const TOTAL = 4; // profile, sync, people, groups carry the progress bar
const LAST = 5; // index of the "done" screen

function stepConfig(step: number, saving: boolean) {
  switch (step) {
    case 0: return { primary: "Set up my profile", ghost: true, skip: false, back: false, prog: 0 };
    case 1: return { primary: "Continue", ghost: false, skip: true, back: true, prog: 1 };
    case 2: return { primary: "Continue", ghost: false, skip: true, back: true, prog: 2 };
    case 3: return { primary: "Continue", ghost: false, skip: true, back: true, prog: 3 };
    case 4: return { primary: "Finish setup", ghost: false, skip: true, back: true, prog: 4 };
    default: return { primary: saving ? "Setting up…" : "Jump into Livelee", ghost: false, skip: false, back: false, prog: 4 };
  }
}

export default function OnboardingPage() {
  const { user, loading, refreshProfile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // profile
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // activity sync
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const fitbitConfigured = !!process.env.NEXT_PUBLIC_FITBIT_CLIENT_ID;

  // social
  const [people, setPeople] = useState<SuggestedUser[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [follows, setFollows] = useState<Set<string>>(new Set());
  const [joins, setJoins] = useState<Set<string>>(new Set());

  const username = user?.profile?.username || "newathlete";

  // Detect HealthKit on the client only (it's false during SSR) to avoid a
  // hydration mismatch on the sync step.
  useEffect(() => {
    setHealthAvailable(isHealthKitAvailable());
  }, []);

  // Guard + load. Already-onboarded users and business accounts don't belong
  // here; everyone else gets their suggestions fetched for the social steps.
  useEffect(() => {
    if (loading || !user) return;
    if (isBusinessAccount(user.profile)) {
      router.replace("/feed");
      return;
    }
    if ((user.profile as any)?.onboarded === true) {
      router.replace("/feed");
      return;
    }
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  async function loadSuggestions() {
    if (!user) return;
    try {
      const [pplRes, grpRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, username, full_name, avatar_url, followers_count")
          .neq("id", user.id)
          .order("followers_count", { ascending: false })
          .limit(8),
        supabase
          .from("groups")
          .select("*")
          .order("members_count", { ascending: false })
          .limit(6),
      ]);
      if (pplRes.data) setPeople(pplRes.data as SuggestedUser[]);
      if (grpRes.data) setGroups(grpRes.data as any[]);
    } catch {
      /* suggestions are optional — the empty states handle a miss */
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>, which: "avatar" | "banner") {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      if (which === "avatar") setAvatarPreview(url);
      else setBannerPreview(url);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function connectHealth() {
    if (!user || healthBusy) return;
    setHealthBusy(true);
    try {
      const ok = await requestHealthKitPermissions(user.id);
      if (ok) {
        setHealthConnected(true);
        // Fire-and-forget the first import so stats aren't empty on arrival.
        runHealthKitSync(user.id).catch(() => {});
      }
    } catch {
      /* user can always connect later from Settings */
    }
    setHealthBusy(false);
  }

  function connectFitbit() {
    if (!user) return;
    const clientId = process.env.NEXT_PUBLIC_FITBIT_CLIENT_ID;
    if (!clientId) return;
    const state = `${user.id}_${Date.now()}_${Math.random()}`;
    const redirectUri = `${window.location.origin}/api/fitbit-callback`;
    window.location.href = getFitbitAuthURL(clientId, redirectUri, state);
  }

  function toggleFollow(id: string) {
    setFollows((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  }

  function toggleJoin(id: string) {
    setJoins((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  }

  function goNext() {
    if (step < LAST) setStep((s) => s + 1);
    else handleFinish();
  }
  function goBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function handleFinish() {
    if (!user || saving) return;
    setSaving(true);

    // Photo uploads are best-effort — a failed image must NEVER block the
    // onboarded write below, or the user gets trapped in the flow.
    let avatarUrl: string | null = null;
    let bannerUrl: string | null = null;
    try {
      if (avatarPreview) avatarUrl = await uploadPhoto(avatarPreview, "avatars", `${user.id}/avatar.jpg`);
      if (bannerPreview) bannerUrl = await uploadPhoto(bannerPreview, "avatars", `${user.id}/banner.jpg`);
    } catch {
      /* keep going — profile photos can be added later */
    }

    // The critical write: mark onboarded so the layout guard releases the user.
    try {
      const update: Record<string, any> = { onboarded: true };
      if (displayName.trim()) update.full_name = displayName.trim();
      if (bio.trim()) update.bio = bio.trim();
      if (avatarUrl) update.avatar_url = avatarUrl;
      if (bannerUrl) update.banner_url = bannerUrl;
      await (supabase.from("users") as any).update(update).eq("id", user.id);
    } catch {
      /* don't trap the user even if this write fails */
    }

    // Social selections — also best-effort, isolated so one failure can't
    // abort the rest or the navigation.
    try {
      const followIds = Array.from(follows);
      if (followIds.length) {
        await supabase
          .from("follows")
          .insert(followIds.map((fid) => ({ follower_id: user.id, following_id: fid })) as any);
      }
      for (const gid of Array.from(joins)) {
        try {
          await fetch("/api/db", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "join_group", payload: { userId: user.id, groupId: gid } }),
          });
        } catch {
          /* one failed join shouldn't block finishing setup */
        }
      }
    } catch {
      /* social is optional — never let it strand the user */
    }

    // Refresh the cached auth profile so the app layout sees onboarded = true
    // immediately. Without this the in-memory profile stays stale, the layout's
    // onboarding guard re-fires, and the user is bounced straight back here.
    try {
      await refreshProfile();
    } catch {
      /* navigation still proceeds; worst case a reload settles it */
    }

    setSaving(false);
    router.push("/feed");
  }

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", border: "4px solid #1E3D34", borderTopColor: C.purple, animation: "ob-spin 0.8s linear infinite" }} />
        <style>{`@keyframes ob-spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const cfg = stepConfig(step, saving);
  const progressPct = (cfg.prog / TOTAL) * 100;
  const initial = (displayName.trim() || username).charAt(0).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column", maxWidth: 560, margin: "0 auto" }}>
      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onPickFile(e, "avatar")} />
      <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onPickFile(e, "banner")} />

      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px 12px", background: C.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={goBack} aria-label="Back" style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border2}`, background: C.card2, color: C.text, fontSize: 18, cursor: "pointer", visibility: cfg.back ? "visible" : "hidden", flex: "0 0 auto" }}>‹</button>
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: "#211E2C", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, borderRadius: 99, background: `linear-gradient(90deg, ${C.purple}, ${C.purpleSoft})`, transition: "width 0.4s ease" }} />
        </div>
        <button onClick={goNext} style={{ fontSize: 13.5, fontWeight: 600, color: C.sub, background: "none", border: "none", cursor: "pointer", visibility: cfg.skip ? "visible" : "hidden", flex: "0 0 auto" }}>Skip</button>
      </div>

      {/* scroll area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px 24px" }}>

        {/* 0 — WELCOME */}
        {step === 0 && (
          <div>
            <div style={{ width: 74, height: 74, borderRadius: 22, margin: "8px 0 22px", background: `linear-gradient(135deg, ${C.purple}, #9D5CFF)`, boxShadow: "0 14px 34px rgba(124,58,237,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38 }}>⚡</div>
            <h1 style={{ fontSize: 29, lineHeight: 1.12, fontWeight: 850, letterSpacing: "-0.5px", color: "#fff" }}>Welcome to Livelee.</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: C.sub, marginTop: 10 }}>The home for your training. Log every lift, run, and recovery session — then share the journey, line up rivals, and find people who push you harder.</p>
            <div style={{ marginTop: 24 }}>
              {[
                { i: "📈", t: "Log what you train", s: "Lifting, cardio, wellness, nutrition — one place, with stats that actually add up." },
                { i: "🔥", t: "Compete with rivals", s: "Head-to-head matchups and group challenges that keep you showing up." },
                { i: "🤝", t: "Find your people", s: "Join groups, follow athletes, and share wins in a feed that's all fitness." },
              ].map((v, idx) => (
                <div key={idx} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "15px 0", borderBottom: idx < 2 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: C.purpleGhost, border: "1px solid rgba(124,58,237,0.25)" }}>{v.i}</div>
                  <div>
                    <div style={{ fontSize: 15.5, fontWeight: 750, color: C.text }}>{v.t}</div>
                    <div style={{ fontSize: 13, color: C.sub, marginTop: 3, lineHeight: 1.45 }}>{v.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 1 — PROFILE */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: C.purpleSoft, marginBottom: 10 }}>Step 1 of 4</div>
            <h1 style={{ fontSize: 29, lineHeight: 1.12, fontWeight: 850, letterSpacing: "-0.5px", color: "#fff" }}>Make it yours.</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: C.sub, marginTop: 10 }}>Add a photo and a couple words. This is how your crew sees you in the feed and on the leaderboard.</p>

            {/* live preview */}
            <div style={{ borderRadius: 20, overflow: "hidden", background: C.card, border: `1px solid ${C.border}`, margin: "18px 0 22px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ height: 96, position: "relative", background: bannerPreview ? `url(${bannerPreview}) center/cover` : "linear-gradient(120deg,#241B40,#3A2A66 60%,#1c1830)" }}>
                {!bannerPreview && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>🖼️ add a banner</div>}
                <div style={{ width: 72, height: 72, borderRadius: "50%", border: `3px solid ${C.card}`, position: "absolute", left: 18, bottom: -30, background: avatarPreview ? `url(${avatarPreview}) center/cover` : C.raised, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: C.purpleSoft }}>{!avatarPreview && "🙂"}</div>
              </div>
              <div style={{ padding: "38px 18px 18px" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{displayName.trim() || "Your name"}</div>
                <div style={{ fontSize: 13, color: C.purpleSoft, marginTop: 1 }}>@{username}</div>
                <div style={{ fontSize: 13.5, color: C.sub, marginTop: 9, lineHeight: 1.45, minHeight: 18 }}>{bio.trim() || "Your bio shows up here."}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button onClick={() => avatarInputRef.current?.click()} style={{ flex: 1, border: avatarPreview ? `1px solid ${C.purple}` : `1px dashed ${C.border2}`, borderRadius: 14, background: avatarPreview ? C.purpleGhost : C.card2, padding: "14px 10px", textAlign: "center", cursor: "pointer", color: C.text }}>
                <div style={{ fontSize: 20 }}>📷</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: avatarPreview ? C.purpleSoft : C.sub, marginTop: 5 }}>{avatarPreview ? "Photo added" : "Profile photo"}</div>
              </button>
              <button onClick={() => bannerInputRef.current?.click()} style={{ flex: 1, border: bannerPreview ? `1px solid ${C.purple}` : `1px dashed ${C.border2}`, borderRadius: 14, background: bannerPreview ? C.purpleGhost : C.card2, padding: "14px 10px", textAlign: "center", cursor: "pointer", color: C.text }}>
                <div style={{ fontSize: 20 }}>🖼️</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: bannerPreview ? C.purpleSoft : C.sub, marginTop: 5 }}>{bannerPreview ? "Banner added" : "Banner image"}</div>
              </button>
            </div>

            <div style={{ marginBottom: 13 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: C.sub, marginBottom: 7 }}>Display name</label>
              <input value={displayName} maxLength={30} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Jordan Rivera" style={{ width: "100%", background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 13, padding: "13px 14px", color: C.text, fontSize: 15 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: C.sub, marginBottom: 7 }}>Short bio</label>
              <textarea value={bio} rows={2} maxLength={120} onChange={(e) => setBio(e.target.value)} placeholder="What are you training for?" style={{ width: "100%", background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 13, padding: "13px 14px", color: C.text, fontSize: 15, fontFamily: "inherit", resize: "none" }} />
            </div>
          </div>
        )}

        {/* 2 — SYNC ACTIVITY */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: C.purpleSoft, marginBottom: 10 }}>Step 2 of 4</div>
            <h1 style={{ fontSize: 29, lineHeight: 1.12, fontWeight: 850, letterSpacing: "-0.5px", color: "#fff" }}>Sync your activity.</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: C.sub, marginTop: 10 }}>Connect a tracker and your past workouts, steps, and heart rate flow straight in — so your stats and profile aren&apos;t empty on day one.</p>

            <div style={{ marginTop: 20 }}>
              {healthAvailable && (
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, border: `1.5px solid ${healthConnected ? C.green : C.border2}`, borderRadius: 18, background: healthConnected ? "rgba(34,197,94,0.08)" : C.card, marginBottom: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 15, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 27, background: "#fff" }}>❤️</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Apple Health</div>
                    <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 1.4 }}>Workouts, steps &amp; heart rate from your iPhone &amp; Watch.</div>
                  </div>
                  <button onClick={connectHealth} disabled={healthBusy || healthConnected} style={{ flex: "0 0 auto", border: `1.5px solid ${healthConnected ? C.green : C.purple}`, background: healthConnected ? C.green : "transparent", color: healthConnected ? "#fff" : C.purpleSoft, fontSize: 13.5, fontWeight: 800, borderRadius: 99, padding: "9px 17px", cursor: healthConnected ? "default" : "pointer" }}>{healthConnected ? "Connected ✓" : healthBusy ? "…" : "Connect"}</button>
                </div>
              )}

              {fitbitConfigured && (
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, border: `1.5px solid ${C.border2}`, borderRadius: 18, background: C.card, marginBottom: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 15, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 27, background: C.teal }}>⌚</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Fitbit</div>
                    <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 1.4 }}>Daily activity, sleep &amp; resting heart rate.</div>
                  </div>
                  <button onClick={connectFitbit} style={{ flex: "0 0 auto", border: `1.5px solid ${C.purple}`, background: "transparent", color: C.purpleSoft, fontSize: 13.5, fontWeight: 800, borderRadius: 99, padding: "9px 17px", cursor: "pointer" }}>Connect</button>
                </div>
              )}

              {!healthAvailable && !fitbitConfigured && (
                <div style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 16, background: C.card2, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>
                  Activity sync is available in the iPhone app. You can connect Apple Health anytime from Settings once you&apos;re in.
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 16, padding: "13px 14px", borderRadius: 13, background: C.card2, border: `1px solid ${C.border}`, fontSize: 12.5, color: C.sub, lineHeight: 1.45 }}>
              <span>🔒</span>
              <span>You choose exactly what Livelee can read, and you can disconnect anytime in Settings.</span>
            </div>
          </div>
        )}

        {/* 3 — PEOPLE */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: C.purpleSoft, marginBottom: 10 }}>Step 3 of 4</div>
            <h1 style={{ fontSize: 29, lineHeight: 1.12, fontWeight: 850, letterSpacing: "-0.5px", color: "#fff" }}>Find your people.</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: C.sub, marginTop: 10 }}>Follow a few athletes and your feed&apos;s got something in it the moment you walk in.</p>

            <div style={{ marginTop: 18 }}>
              {people.length === 0 && (
                <div style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 16, background: C.card2, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>
                  No suggestions yet — you can discover and follow athletes anytime from the Discover tab.
                </div>
              )}
              {people.map((p) => {
                const on = follows.has(p.id);
                const name = p.full_name || p.username || "Athlete";
                const av = (name || "A").charAt(0).toUpperCase();
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: 13, border: `1px solid ${C.border}`, borderRadius: 16, background: C.card, marginBottom: 11 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, color: "#fff", fontWeight: 800, background: p.avatar_url ? `url(${p.avatar_url}) center/cover` : C.purple }}>{!p.avatar_url && av}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 750, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{p.username || "athlete"}{p.followers_count ? ` · ${p.followers_count} followers` : ""}</div>
                    </div>
                    <button onClick={() => toggleFollow(p.id)} style={{ flex: "0 0 auto", border: `1.5px solid ${C.purple}`, background: on ? C.purple : "transparent", color: on ? "#fff" : C.purpleSoft, fontSize: 13.5, fontWeight: 800, borderRadius: 99, padding: "8px 17px", cursor: "pointer" }}>{on ? "Following" : "Follow"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4 — GROUPS */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: C.purpleSoft, marginBottom: 10 }}>Step 4 of 4</div>
            <h1 style={{ fontSize: 29, lineHeight: 1.12, fontWeight: 850, letterSpacing: "-0.5px", color: "#fff" }}>Join a group.</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: C.sub, marginTop: 10 }}>Groups are where the challenges and leaderboards live. Jump into a few that match your vibe.</p>

            <div style={{ marginTop: 18 }}>
              {groups.length === 0 && (
                <div style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 16, background: C.card2, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>
                  No groups to show yet — you can browse and join groups anytime from the Connect tab.
                </div>
              )}
              {groups.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                  {groups.map((g) => {
                    const on = joins.has(g.id);
                    const emoji = (g as any).emoji || "🏋️";
                    const members = g.members_count ?? 0;
                    return (
                      <button key={g.id} onClick={() => toggleJoin(g.id)} style={{ textAlign: "left", border: `1.5px solid ${on ? C.purple : C.border2}`, borderRadius: 16, background: C.card, padding: 14, cursor: "pointer", position: "relative", overflow: "hidden", color: C.text }}>
                        <span style={{ position: "absolute", top: 11, right: 11, fontSize: 11, fontWeight: 800, padding: "4px 9px", borderRadius: 99, background: on ? C.purple : C.card2, color: on ? "#fff" : C.sub, border: `1px solid ${on ? C.purple : C.border2}` }}>{on ? "Joined ✓" : "Join"}</span>
                        <div style={{ fontSize: 26 }}>{emoji}</div>
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 6 }}>{g.name}</div>
                        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{members} member{members === 1 ? "" : "s"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5 — DONE */}
        {step === 5 && (
          <div>
            <div style={{ width: 96, height: 96, borderRadius: "50%", margin: "30px auto 24px", background: `linear-gradient(135deg, ${C.purple}, #9D5CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, boxShadow: "0 16px 40px rgba(124,58,237,0.5)" }}>🎉</div>
            <h1 style={{ fontSize: 29, lineHeight: 1.12, fontWeight: 850, letterSpacing: "-0.5px", color: "#fff", textAlign: "center" }}>You&apos;re in.</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: C.sub, marginTop: 10, textAlign: "center" }}>Your profile&apos;s set and your feed&apos;s ready. Time to put your first session on the board.</p>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.card, padding: "6px 16px", marginTop: 24 }}>
              {[
                { ok: !!(avatarPreview || bannerPreview || displayName.trim()), t: "Profile", sk: (avatarPreview || bannerPreview || displayName.trim()) ? "Set up" : "Skipped" },
                { ok: healthConnected, t: "Activity sync", sk: healthConnected ? "Apple Health" : "Skipped" },
                { ok: follows.size > 0, t: "Following", sk: follows.size > 0 ? `${follows.size} athlete${follows.size === 1 ? "" : "s"}` : "Skipped" },
                { ok: joins.size > 0, t: "Groups", sk: joins.size > 0 ? `Joined ${joins.size}` : "Skipped" },
              ].map((r, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 0", borderBottom: idx < 3 ? `1px solid ${C.border}` : "none", fontSize: 14, color: C.text }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: r.ok ? "rgba(34,197,94,0.16)" : "#23202c", color: r.ok ? C.green : C.dim, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{r.ok ? "✓" : "–"}</div>
                  {r.t}
                  <span style={{ color: C.dim, marginLeft: "auto", fontSize: 12.5 }}>{r.sk}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 14, textAlign: "center", lineHeight: 1.5 }}>You can change any of this anytime from your profile.</div>
          </div>
        )}
      </div>

      {/* bottom CTA */}
      <div style={{ padding: "12px 22px 24px", background: C.bg }}>
        <button onClick={goNext} disabled={saving} style={{ width: "100%", border: "none", borderRadius: 16, padding: 16, fontSize: 16, fontWeight: 800, letterSpacing: "0.2px", color: "#fff", background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDark})`, boxShadow: "0 10px 26px rgba(124,58,237,0.42)", cursor: saving ? "default" : "pointer", opacity: saving ? 0.75 : 1 }}>{cfg.primary}</button>
        {cfg.ghost && (
          <button onClick={handleFinish} disabled={saving} style={{ width: "100%", border: "none", background: "transparent", color: C.sub, fontWeight: 700, padding: 12, marginTop: 2, cursor: "pointer" }}>Skip for now</button>
        )}
      </div>
    </div>
  );
}
