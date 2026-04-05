"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";

const C = {
  blue: "#16A34A",
  greenLight: "#1A2A1A",
  greenMid: "#2A3A2A",
  gold: "#F5A623",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  white: "#1A1A1A",
  bg: "#0D0D0D",
};

const iStyle = {
  background: "#111111",
  border: `1.5px solid ${C.greenMid}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 14,
  color: C.text,
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

type Exercise = { name: string; sets: string; reps: string; weight: string; weights: string[] };
type FoodItem = { name: string; calories: string };
type LogTab = "workout" | "nutrition" | "wellness";
type MainMode = "log" | "feed";
type PostType = "Workout" | "Nutrition" | "Wellness" | "Achievement" | "Other";

const MOOD_EMOJIS = ["😤", "💪", "😊", "🧘", "😴"];
const WELLNESS_TYPES = ["Yoga", "Meditation", "Stretching", "Cold Plunge", "Sauna", "Breathwork", "Walk", "Sleep", "Other"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout", "Post-workout"];
const POST_TYPES: PostType[] = ["Workout", "Nutrition", "Wellness", "Achievement", "Other"];

export default function PostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mainMode, setMainMode] = useState<MainMode>("log");
  const [logTab, setLogTab] = useState<LogTab>("workout");
  const [saved, setSaved] = useState(false);
  const [posted, setPosted] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submittingRef = useRef(false); // hard lock — prevents double-submit even with rapid clicks

  // Workout state
  const [woType, setWoType] = useState("");
  const [woDuration, setWoDuration] = useState("");
  const [woCalories, setWoCalories] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [cardioType, setCardioType] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [woNotes, setWoNotes] = useState("");
  const [woPhoto, setWoPhoto] = useState<string | null>(null);

  // Nutrition state
  const [mealType, setMealType] = useState("Breakfast");
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [water, setWater] = useState("");
  const [nutNotes, setNutNotes] = useState("");
  const [nutPhoto, setNutPhoto] = useState<string | null>(null);
  const [mealPhotos, setMealPhotos] = useState<Record<string, string>>({});

  // Wellness state
  const [wellnessType, setWellnessType] = useState("Yoga");
  const [wellnessDuration, setWellnessDuration] = useState("");
  const [wellnessNotes, setWellnessNotes] = useState("");
  const [mood, setMood] = useState("");
  const [wellnessPhotoUrl, setWellnessPhotoUrl] = useState<string | null>(null);

  // Feed state
  const [feedPhoto, setFeedPhoto] = useState<string | null>(null);
  const [feedPhotos, setFeedPhotos] = useState<string[]>([]); // carousel
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [caption, setCaption] = useState("");
  const [tagPeople, setTagPeople] = useState("");
  const [location, setLocation] = useState("");
  const [postType, setPostType] = useState<PostType>("Workout");

  function loadPhoto(e: React.ChangeEvent<HTMLInputElement>, set: (s: string) => void) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => set(ev.target!.result as string); r.readAsDataURL(f); e.target.value = "";
  }

  async function ensureProfile() {
    if (!user) return false;
    const { data } = await supabase.from('users').select('id').eq('id', user.id).single();
    if (!data) {
      const email = user.email || '';
      const fallback = email.split('@')[0] || 'user';
      const { error } = await supabase.from('users').insert({
        id: user.id,
        username: (user.user_metadata?.username || fallback).toLowerCase().replace(/[^a-z0-9_]/g, ''),
        full_name: user.user_metadata?.full_name || fallback,
      });
      if (error) return false;
    }
    return true;
  }

  async function handleSave() {
    if (!user) {
      setSaveError("You must be logged in. Please refresh and sign in again.");
      return;
    }
    if (submittingRef.current || loading || saved) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    // Best-effort profile creation — never block the save
    await ensureProfile().catch(() => {});

    const base = { user_id: user.id, is_public: !isPrivate, logged_at: new Date().toISOString() };
    let error: any = null;

    try {
      if (logTab === 'workout') {
        // Upload workout photo if present
        let woPhotoUrl: string | null = null;
        if (woPhoto) {
          woPhotoUrl = await uploadPhoto(woPhoto, 'activity', `${user.id}/workout-${Date.now()}.jpg`);
        }
        // Normalize exercises: ensure weights array is stored
        const normalizedExercises = exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: (ex.weights || [])[0] || ex.weight || '',
          weights: ex.weights && ex.weights.length > 0 ? ex.weights : [ex.weight || ''],
        }));
        const res = await supabase.from('activity_logs').insert({
          ...base,
          log_type: 'workout',
          workout_type: woType || null,
          workout_duration_min: woDuration ? parseInt(woDuration) : null,
          workout_calories: woCalories ? parseInt(woCalories) : null,
          exercises: normalizedExercises.length > 0 ? normalizedExercises : null,
          cardio: cardioType ? [{ type: cardioType, duration: cardioDuration, distance: cardioDistance }] : null,
          notes: woNotes || null,
          photo_url: woPhotoUrl,
        });
        error = res.error;
      } else if (logTab === 'nutrition') {
        // Upload per-meal photos
        const uploadedMealPhotos: Record<string, string> = {};
        for (const [meal, dataUrl] of Object.entries(mealPhotos)) {
          if (dataUrl) {
            const url = await uploadPhoto(dataUrl, 'activity', `${user.id}/nutrition-${meal.toLowerCase()}-${Date.now()}.jpg`);
            if (url) uploadedMealPhotos[meal] = url;
          }
        }
        // Also upload legacy single photo if set
        let nutPhotoUrl: string | null = null;
        if (nutPhoto) {
          nutPhotoUrl = await uploadPhoto(nutPhoto, 'activity', `${user.id}/nutrition-${Date.now()}.jpg`);
        }
        // Store meal photos as JSON string, or single URL for backward compat
        const photoUrlToStore = Object.keys(uploadedMealPhotos).length > 0
          ? JSON.stringify(uploadedMealPhotos)
          : nutPhotoUrl;
        const res = await supabase.from('activity_logs').insert({
          ...base,
          log_type: 'nutrition',
          meal_type: mealType,
          food_items: foodItems.length > 0 ? foodItems : null,
          calories_total: foodItems.length > 0 ? foodItems.reduce((s, f) => s + (parseFloat(f.calories) || 0), 0) : null,
          protein_g: protein ? parseFloat(protein) : null,
          carbs_g: carbs ? parseFloat(carbs) : null,
          fat_g: fat ? parseFloat(fat) : null,
          water_oz: water ? parseFloat(water) : null,
          notes: nutNotes || null,
          photo_url: photoUrlToStore,
        });
        error = res.error;
      } else if (logTab === 'wellness') {
        // Upload wellness photo if present
        let wellnessUploadedUrl: string | null = null;
        if (wellnessPhotoUrl) {
          wellnessUploadedUrl = await uploadPhoto(wellnessPhotoUrl, 'activity', `${user.id}/wellness-${Date.now()}.jpg`);
        }
        const res = await supabase.from('activity_logs').insert({
          ...base,
          log_type: 'wellness',
          wellness_type: wellnessType,
          wellness_duration_min: wellnessDuration ? parseInt(wellnessDuration) : null,
          mood: mood || null,
          notes: wellnessNotes || null,
          photo_url: wellnessUploadedUrl || null,
        });
        error = res.error;
      }
    } catch (e: any) {
      error = { message: e?.message || "Network error. Check your connection and try again." };
    }

    setLoading(false);
    if (error) {
      submittingRef.current = false; // allow retry on error
      setSaveError(error.message || "Something went wrong. Please try again.");
    } else {
      setSaved(true);
      // ref stays true — log saved, no retry needed
    }
  }

  // uploadPhoto imported from @/lib/uploadPhoto — uses server-side API to bypass storage RLS

  async function handlePost() {
    if (!user) {
      setSaveError("You must be logged in. Please refresh and sign in again.");
      return;
    }
    if (submittingRef.current || loading || posted) return; // hard lock — ref fires before state re-render
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    const profileOk = await ensureProfile();
    if (!profileOk) {
      setSaveError("Could not verify your profile. Please refresh and try again.");
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    // Upload all carousel photos
    const photosToUpload = feedPhotos.length > 0 ? feedPhotos : (feedPhoto ? [feedPhoto] : []);
    const uploadedUrls: string[] = [];
    for (const photo of photosToUpload) {
      const url = await uploadPhoto(photo, 'posts', `${user.id}/${Date.now()}-${uploadedUrls.length}.jpg`);
      if (url) uploadedUrls.push(url);
    }
    const mediaUrl = uploadedUrls[0] || null;

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        caption: caption || null,
        media_url: mediaUrl,
        media_urls: uploadedUrls.length > 1 ? uploadedUrls : null,
        media_type: mediaUrl ? 'image' : null,
        post_type: 'general' as any,
        location: location || null,
        is_public: true,
      });
      setLoading(false);
      if (error) {
        submittingRef.current = false;
        setSaveError(error.message || "Something went wrong. Please try again.");
      } else {
        // ── Auto-award post badges ──────────────────────────────────────────
        try {
          const { count } = await supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
          const postCount = count || 1;
          if (postCount === 1) {
            await supabase.from('badges').insert({ user_id: user.id, badge_id: 'first-post' }).match({ user_id: user.id, badge_id: 'first-post' });
          }
          if (postCount >= 10) {
            await supabase.from('badges').insert({ user_id: user.id, badge_id: '10-posts' }).match({ user_id: user.id, badge_id: '10-posts' });
          }
        } catch {}
        setPosted(true);
        // ref stays true — post is done, we never want another submit
      }
    } catch (e: any) {
      setLoading(false);
      submittingRef.current = false;
      setSaveError(e?.message || "Network error. Check your connection and try again.");
    }
  }

  const SaveErrorBanner = () => saveError ? (
    <div style={{ background: "#FEE2E2", border: "1.5px solid #FECACA", borderRadius: 14, padding: "12px 16px", fontSize: 13, color: "#DC2626", fontWeight: 600 }}>
      {"\u26A0\uFE0F"} {saveError}
    </div>
  ) : null;

  const PrivacyToggle = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.white, borderRadius: 16, padding: "14px 18px", border: `2px solid ${C.greenMid}`, marginBottom: 4 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{isPrivate ? "🔒 Private" : "🌐 Public on Profile"}</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
          {isPrivate ? "Only you can see this" : "Visible on your profile to followers"}
        </div>
      </div>
      <button onClick={() => setIsPrivate(p => !p)} style={{
        width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
        background: isPrivate ? "#E5E7EB" : C.blue, transition: "background 0.2s",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3, transition: "left 0.2s",
          left: isPrivate ? 3 : 27,
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }} />
      </button>
    </div>
  );

  if (saved) {
    setTimeout(() => router.push("/profile"), 1500);
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 64 }}>✅</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.blue }}>Saved to Log!</div>
        <div style={{ fontSize: 14, color: C.sub, marginTop: 8 }}>{isPrivate ? "🔒 Saved privately" : "🌐 Visible on your profile"}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Taking you to your profile...</div>
      </div>
    );
  }

  if (posted) {
    setTimeout(() => router.push("/feed"), 1500);
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 64 }}>🚀</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.blue }}>Posted to Feed!</div>
        <div style={{ fontSize: 14, color: C.sub, marginTop: 8 }}>🌐 Visible to your followers</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Taking you to the feed...</div>
      </div>
    );
  }

  const TAB_DEFS = [
    { key: "workout" as LogTab, icon: "💪", label: "Workout", color: "#16A34A" },
    { key: "nutrition" as LogTab, icon: "🥗", label: "Nutrition", color: "#F59E0B" },
    { key: "wellness" as LogTab, icon: "🌿", label: "Wellness", color: "#7C3AED" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 100 }}>
      <style jsx global>{`
        .post-layout { display: flex; min-height: 100vh; }
        .post-sidebar { display: none; }
        .post-main { flex: 1; }
        @media (min-width: 768px) {
          .post-sidebar {
            display: flex;
            flex-direction: column;
            width: 220px;
            flex-shrink: 0;
            background: white;
            border-right: 2px solid #BBF7D0;
            padding: 32px 16px;
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
          }
          .post-main { padding: 32px 40px; max-width: 800px; }
          .post-mobile-header { display: none !important; }
          .post-mobile-tabs { display: none !important; }
        }
        @media (max-width: 767px) {
          .post-sidebar { display: none !important; }
        }
      `}</style>

      {/* Mobile header */}
      <div className="post-mobile-header" style={{ background: C.white, borderBottom: `2px solid ${C.greenMid}`, padding: "20px 20px 0" }}>
        <div style={{ fontWeight: 900, fontSize: 22, color: C.text, marginBottom: 14 }}>
          {mainMode === "log" ? "📝 Log Activity" : "📸 Share to Feed"}
        </div>
        <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: `2px solid ${C.greenMid}`, marginBottom: 10, background: C.greenLight }}>
          {(["log", "feed"] as MainMode[]).map(m => (
            <button key={m} onClick={() => setMainMode(m)} style={{
              flex: 1, padding: "11px 0", fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer",
              background: mainMode === m ? `linear-gradient(135deg,${C.blue},#22C55E)` : "transparent",
              color: mainMode === m ? "#fff" : C.sub, transition: "all 0.2s",
            }}>
              {m === "log" ? "📝 Log Activity" : "📸 Share to Feed"}
            </button>
          ))}
        </div>
        {mainMode === "log" && (
          <div className="post-mobile-tabs" style={{ display: "flex", gap: 4 }}>
            {TAB_DEFS.map(t => (
              <button key={t.key} onClick={() => setLogTab(t.key)} style={{
                padding: "10px 14px", borderRadius: "12px 12px 0 0", border: "none",
                fontWeight: 800, fontSize: 13, cursor: "pointer",
                background: logTab === t.key ? t.color : "transparent",
                color: logTab === t.key ? "#fff" : C.sub,
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="post-layout">

        {/* ── Desktop sidebar ── */}
        <div className="post-sidebar">
          <div style={{ fontWeight: 900, fontSize: 15, color: C.text, marginBottom: 24, letterSpacing: -0.3 }}>FIT ⚡</div>

          {/* Mode toggle */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Mode</div>
            {(["log", "feed"] as MainMode[]).map(m => (
              <button key={m} onClick={() => setMainMode(m)} style={{
                width: "100%", padding: "12px 14px", borderRadius: 14, border: "none", cursor: "pointer",
                marginBottom: 6, textAlign: "left", fontWeight: 800, fontSize: 14,
                background: mainMode === m ? `linear-gradient(135deg,${C.blue},#22C55E)` : C.greenLight,
                color: mainMode === m ? "#fff" : C.sub,
                transition: "all 0.15s",
              }}>
                {m === "log" ? "📝 Log Activity" : "📸 Share to Feed"}
              </button>
            ))}
          </div>

          {/* Log sub-tabs — only when in log mode */}
          {mainMode === "log" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Activity Type</div>
              {TAB_DEFS.map(t => (
                <button key={t.key} onClick={() => setLogTab(t.key)} style={{
                  width: "100%", padding: "16px 18px", borderRadius: 16, border: "none", cursor: "pointer",
                  marginBottom: 8, textAlign: "left", fontWeight: 800, fontSize: 16,
                  background: logTab === t.key ? t.color : C.greenLight,
                  color: logTab === t.key ? "#fff" : C.sub,
                  transition: "all 0.15s",
                  boxShadow: logTab === t.key ? `0 4px 16px ${t.color}40` : "none",
                }}>
                  <span style={{ fontSize: 22, marginRight: 10 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Privacy note on sidebar */}
          <div style={{ marginTop: "auto", paddingTop: 24, borderTop: `1px solid ${C.greenMid}`, fontSize: 11, color: C.sub, lineHeight: 1.5 }}>
            {mainMode === "log"
              ? "🌐 Public by default — visible on your profile. Toggle private per-entry."
              : "🌐 Posted to your followers' feed."}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="post-main" style={{ padding: "24px 20px" }}>
        {mainMode === "log" ? (<>

          {/* ─── WORKOUT TAB ─── */}
          {logTab === "workout" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>💪 Workout Details</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Workout Type</label>
                  <input style={iStyle} placeholder="e.g. Push Day, Leg Day, HIIT..." value={woType} onChange={e => setWoType(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Duration</label>
                    <input style={iStyle} placeholder="e.g. 45 min" value={woDuration} onChange={e => setWoDuration(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Calories Burned</label>
                    <input style={iStyle} type="text" inputMode="numeric" placeholder="e.g. 450" value={woCalories} onChange={e => setWoCalories(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Exercises table */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Exercises</div>
                  <button onClick={() => setExercises(ex => [...ex, { name: "", sets: "3", reps: "10", weight: "", weights: ["", "", ""] }])}
                    style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.blue}`, background: C.greenLight, color: C.blue, cursor: "pointer" }}>
                    + Add Row
                  </button>
                </div>
                {exercises.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.sub, fontSize: 13 }}>No exercises yet — click + Add Row</div>
                ) : (<>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 1fr 36px", gap: 8, marginBottom: 8 }}>
                    {["Exercise", "Sets", "Reps", "Weight", ""].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</span>
                    ))}
                  </div>
                  {exercises.map((ex, i) => {
                    const numSets = parseInt(ex.sets) || 1;
                    const isMultiSet = numSets > 1;
                    return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 1fr 36px", gap: 8, marginBottom: 8, alignItems: "start" }}>
                      <input style={iStyle} placeholder="Name" value={ex.name} onChange={e => setExercises(exs => exs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                      <input style={iStyle} type="text" inputMode="numeric" value={ex.sets} onChange={e => {
                        const newSets = e.target.value;
                        const n = parseInt(newSets) || 1;
                        setExercises(exs => exs.map((x, j) => {
                          if (j !== i) return x;
                          const existingWeights = x.weights || [];
                          const firstW = existingWeights[0] || x.weight || '';
                          const newWeights = Array(n).fill('').map((_, k) => existingWeights[k] ?? firstW);
                          return { ...x, sets: newSets, weights: newWeights };
                        }));
                      }} />
                      <input style={iStyle} type="text" inputMode="numeric" value={ex.reps} onChange={e => setExercises(exs => exs.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} />
                      {/* Weight column — single or per-set */}
                      {isMultiSet ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {Array.from({ length: numSets }).map((_, s) => (
                            <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 10, color: C.sub, fontWeight: 700, width: 36, flexShrink: 0 }}>S{s+1}:</span>
                              <input
                                style={{ ...iStyle, padding: "5px 8px", fontSize: 12 }}
                                placeholder="lbs"
                                value={(ex.weights || [])[s] ?? ''}
                                onChange={e => setExercises(exs => exs.map((x, j) => {
                                  if (j !== i) return x;
                                  const ws = [...(x.weights || Array(numSets).fill(''))];
                                  ws[s] = e.target.value;
                                  return { ...x, weights: ws };
                                }))}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <input style={iStyle} placeholder="lbs" value={(ex.weights || [])[0] ?? ex.weight ?? ''} onChange={e => setExercises(exs => exs.map((x, j) => j === i ? { ...x, weight: e.target.value, weights: [e.target.value] } : x))} />
                      )}
                      <button onClick={() => setExercises(exs => exs.filter((_, j) => j !== i))} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#FFE8E8", color: "#FF4444", fontSize: 18, cursor: "pointer" }}>×</button>
                    </div>
                    );
                  })}
                </>)}
              </div>

              {/* Cardio */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>🏃 Cardio (optional)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Type</label>
                    <input style={iStyle} placeholder="e.g. Running" value={cardioType} onChange={e => setCardioType(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Duration</label>
                    <input style={iStyle} placeholder="e.g. 20 min" value={cardioDuration} onChange={e => setCardioDuration(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Distance</label>
                    <input style={iStyle} placeholder="e.g. 2 miles" value={cardioDistance} onChange={e => setCardioDistance(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Notes & Photo */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>Notes & Photo</div>
                <textarea rows={3} style={{ ...iStyle, resize: "none", marginBottom: 14 }} placeholder="How did it feel? Any PRs?" value={woNotes} onChange={e => setWoNotes(e.target.value)} />
                <label style={{ display: "block", cursor: "pointer" }}>
                  {woPhoto ? (
                    <img src={woPhoto} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 14, display: "block" }} alt="" />
                  ) : (
                    <div style={{ border: `2px dashed ${C.greenMid}`, borderRadius: 14, padding: "20px 0", textAlign: "center", background: C.greenLight }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>Add photo — won't appear on feed</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Saved privately to your profile</div>
                    </div>
                  )}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => loadPhoto(e, setWoPhoto)} />
                </label>
              </div>

              <SaveErrorBanner />
              <PrivacyToggle />
              <button onClick={handleSave} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading ? C.greenMid : `linear-gradient(135deg,${C.blue},#22C55E)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving..." : "💾 Save to Log"}
              </button>
            </div>
          )}

          {/* ─── NUTRITION TAB ─── */}
          {logTab === "nutrition" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>🥗 Meal Details</div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Meal Type</label>
                <select style={iStyle} value={mealType} onChange={e => setMealType(e.target.value)}>
                  {MEAL_TYPES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              {/* Food items */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Food Items</div>
                  <button onClick={() => setFoodItems(f => [...f, { name: "", calories: "" }])}
                    style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.blue}`, background: C.greenLight, color: C.blue, cursor: "pointer" }}>
                    + Add Row
                  </button>
                </div>
                {foodItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.sub, fontSize: 13 }}>No food items yet — click + Add Row</div>
                ) : foodItems.map((item, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 36px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <input style={iStyle} placeholder="Food name" value={item.name} onChange={e => setFoodItems(f => f.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <input style={iStyle} type="text" inputMode="numeric" placeholder="kcal" value={item.calories} onChange={e => setFoodItems(f => f.map((x, j) => j === i ? { ...x, calories: e.target.value } : x))} />
                    <button onClick={() => setFoodItems(f => f.filter((_, j) => j !== i))} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#FFE8E8", color: "#FF4444", fontSize: 18, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>

              {/* Macros */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>Total Macros</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {[{ l: "Protein (g)", v: protein, s: setProtein }, { l: "Carbs (g)", v: carbs, s: setCarbs }, { l: "Fat (g)", v: fat, s: setFat }].map(f => (
                    <div key={f.l}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.l}</label>
                      <input style={iStyle} type="text" inputMode="numeric" placeholder="0" value={f.v} onChange={e => f.s(e.target.value)} />
                    </div>
                  ))}
                </div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Water Intake</label>
                <input style={iStyle} placeholder="e.g. 80 oz or 2L" value={water} onChange={e => setWater(e.target.value)} />
              </div>

              {/* Per-Meal Photos */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>📷 Meal Photos</div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>Add a photo for the selected meal type ({mealType})</div>
                <label style={{ display: "block", cursor: "pointer" }}>
                  {mealPhotos[mealType] ? (
                    <div style={{ position: "relative" }}>
                      <img src={mealPhotos[mealType]} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 14, display: "block" }} alt="" />
                      <button
                        onClick={e => { e.preventDefault(); setMealPhotos(p => { const n = {...p}; delete n[mealType]; return n; }); }}
                        style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", fontSize: 14, cursor: "pointer" }}>×</button>
                    </div>
                  ) : (
                    <div style={{ border: `2px dashed ${C.greenMid}`, borderRadius: 14, padding: "16px 0", textAlign: "center", background: C.greenLight }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>📷</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>Add {mealType} photo</div>
                    </div>
                  )}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => loadPhoto(e, (url) => setMealPhotos(p => ({ ...p, [mealType]: url })))} />
                </label>
                {/* Show thumbnails of other meal photos already added */}
                {Object.entries(mealPhotos).filter(([k]) => k !== mealType).length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(mealPhotos).filter(([k]) => k !== mealType).map(([meal, src]) => (
                      <div key={meal} style={{ position: "relative" }}>
                        <img src={src} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10 }} alt={meal} />
                        <div style={{ position: "absolute", bottom: 2, left: 2, right: 2, background: "rgba(0,0,0,0.5)", borderRadius: 4, textAlign: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>{meal.slice(0,4)}</div>
                        <button onClick={e => { e.preventDefault(); setMealPhotos(p => { const n = {...p}; delete n[meal]; return n; }); }} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", fontSize: 11, cursor: "pointer", padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes & Photo */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>Notes</div>
                <textarea rows={3} style={{ ...iStyle, resize: "none" }} placeholder="Meal notes..." value={nutNotes} onChange={e => setNutNotes(e.target.value)} />
              </div>

              <SaveErrorBanner />
              <PrivacyToggle />
              <button onClick={handleSave} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading ? C.greenMid : `linear-gradient(135deg,${C.blue},#22C55E)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving..." : "💾 Save to Log"}
              </button>
            </div>
          )}

          {/* ─── WELLNESS TAB ─── */}
          {logTab === "wellness" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>🌿 Wellness Activity</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Activity Type</label>
                  <select style={iStyle} value={wellnessType} onChange={e => setWellnessType(e.target.value)}>
                    {WELLNESS_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Duration</label>
                  <input style={iStyle} placeholder="e.g. 20 min" value={wellnessDuration} onChange={e => setWellnessDuration(e.target.value)} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Notes</label>
                  <textarea rows={3} style={{ ...iStyle, resize: "none" }} placeholder="How was it? How do you feel?" value={wellnessNotes} onChange={e => setWellnessNotes(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Mood</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {MOOD_EMOJIS.map(em => (
                      <button key={em} onClick={() => setMood(mood === em ? "" : em)} style={{
                        width: 52, height: 52, borderRadius: 14,
                        border: `2px solid ${mood === em ? C.blue : C.greenMid}`,
                        background: mood === em ? C.blue : C.greenLight,
                        fontSize: 26, cursor: "pointer",
                        transform: mood === em ? "scale(1.15)" : "scale(1)",
                        transition: "all 0.15s",
                      }}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Wellness photo upload */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ marginTop:0 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:C.sub, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:0.8 }}>Photo (optional)</label>
                  {wellnessPhotoUrl ? (
                    <div style={{ position:"relative", display:"inline-block" }}>
                      <img src={wellnessPhotoUrl} style={{ width:100, height:100, objectFit:"cover", borderRadius:12, border:`2px solid #2A3A2A` }} alt=""/>
                      <button onClick={() => setWellnessPhotoUrl(null)} style={{ position:"absolute", top:4, right:4, width:22, height:22, borderRadius:"50%", background:"rgba(0,0,0,0.7)", border:"none", color:"#fff", fontSize:12, cursor:"pointer" }}>×</button>
                    </div>
                  ) : (
                    <label style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 16px", borderRadius:12, border:`1.5px dashed #2A3A2A`, background:"#111", cursor:"pointer" }}>
                      <span style={{ fontSize:16 }}>📷</span>
                      <span style={{ fontSize:13, color:C.sub }}>Add photo</span>
                      <input type="file" accept="image/*" style={{ display:"none" }} onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const { uploadPhoto } = await import('@/lib/uploadPhoto');
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const dataUrl = ev.target!.result as string;
                          const path = `wellness/${Date.now()}.jpg`;
                          const url = await uploadPhoto(dataUrl, 'activity', path);
                          if (url) setWellnessPhotoUrl(url);
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }}/>
                    </label>
                  )}
                </div>
              </div>

              <SaveErrorBanner />
              <PrivacyToggle />
              <button onClick={handleSave} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading ? C.greenMid : `linear-gradient(135deg,${C.blue},#22C55E)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving..." : "💾 Save to Log"}
              </button>
            </div>
          )}

        </>) : (

          /* ─── SHARE TO FEED ─── */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── Carousel photo area ── */}
            {feedPhotos.length > 0 ? (
              <div style={{ position:"relative",borderRadius:22,overflow:"hidden",background:"#000",aspectRatio:"1/1" }}>
                <img src={feedPhotos[carouselIdx]} style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }} alt="" />
                {/* Dots */}
                {feedPhotos.length > 1 && (
                  <div style={{ position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",display:"flex",gap:5 }}>
                    {feedPhotos.map((_,i)=>(
                      <button key={i} onClick={()=>setCarouselIdx(i)} style={{ width:i===carouselIdx?20:8,height:8,borderRadius:4,border:"none",background:i===carouselIdx?"#fff":"rgba(255,255,255,0.5)",cursor:"pointer",transition:"width 0.2s",padding:0 }}/>
                    ))}
                  </div>
                )}
                {/* Prev/Next */}
                {carouselIdx > 0 && <button onClick={()=>setCarouselIdx(i=>i-1)} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer" }}>‹</button>}
                {carouselIdx < feedPhotos.length-1 && <button onClick={()=>setCarouselIdx(i=>i+1)} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer" }}>›</button>}
                {/* Remove current */}
                <button onClick={()=>{ setFeedPhotos(p=>{ const n=[...p]; n.splice(carouselIdx,1); setCarouselIdx(Math.min(carouselIdx,n.length-1)); return n; }); }} style={{ position:"absolute",top:10,right:10,width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
              </div>
            ) : (
              <label style={{ display:"block",cursor:"pointer" }}>
                <div style={{ border:`2px dashed ${C.greenMid}`,borderRadius:22,aspectRatio:"1/1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.greenLight,gap:12 }}>
                  <div style={{ fontSize:56 }}>📸</div>
                  <div style={{ fontSize:17,fontWeight:800,color:C.blue }}>Add Photos or Videos</div>
                  <div style={{ fontSize:13,color:C.sub }}>Tap to upload • Select multiple</div>
                </div>
                <input type="file" accept="image/*,video/*" multiple style={{ display:"none" }} onChange={e=>{
                  const files = Array.from(e.target.files||[]);
                  files.forEach(f=>{ const r=new FileReader(); r.onload=ev=>setFeedPhotos(p=>[...p,ev.target!.result as string]); r.readAsDataURL(f); });
                  e.target.value="";
                }} />
              </label>
            )}

            {/* Add more button when photos exist */}
            {feedPhotos.length > 0 && (
              <label style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:16,border:`1.5px solid ${C.greenMid}`,background:C.greenLight,cursor:"pointer",justifyContent:"center" }}>
                <span style={{ fontSize:16 }}>➕</span>
                <span style={{ fontWeight:700,fontSize:13,color:C.blue }}>Add more ({feedPhotos.length} photo{feedPhotos.length!==1?"s":""})</span>
                <input type="file" accept="image/*,video/*" multiple style={{ display:"none" }} onChange={e=>{
                  const files = Array.from(e.target.files||[]);
                  files.forEach(f=>{ const r=new FileReader(); r.onload=ev=>setFeedPhotos(p=>[...p,ev.target!.result as string]); r.readAsDataURL(f); });
                  e.target.value="";
                }} />
              </label>
            )}

            {/* Caption + details */}
            <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}`, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Caption</label>
                <textarea rows={4} style={{ ...iStyle, resize: "none" }} placeholder="Share what you crushed today... 💪" value={caption} onChange={e => setCaption(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Tag People</label>
                <input style={iStyle} placeholder="@mention someone" value={tagPeople} onChange={e => setTagPeople(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Location</label>
                <input style={iStyle} placeholder="📍 Add location (e.g. Las Vegas, NV)" value={location} onChange={e => setLocation(e.target.value)} />
              </div>
            </div>

            <button onClick={handlePost} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading?C.greenMid:`linear-gradient(135deg,${C.blue},#22C55E)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading?"not-allowed":"pointer" }}>
              {loading?"Posting...":"Post to Feed 🚀"}
            </button>
          </div>
        )}
        </div>{/* end post-main */}
      </div>{/* end post-layout */}
    </div>
  );
}
