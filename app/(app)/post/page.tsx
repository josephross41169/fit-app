"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const C = {
  blue: "#16A34A",
  greenLight: "#F0FDF4",
  greenMid: "#BBF7D0",
  gold: "#F5A623",
  text: "#1A2B3C",
  sub: "#5A7A8A",
  white: "#FFFFFF",
  bg: "#F0FDF4",
};

const iStyle = {
  background: C.greenLight,
  border: `1.5px solid ${C.greenMid}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 14,
  color: C.text,
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

type Exercise = { name: string; sets: string; reps: string; weight: string };
type FoodItem = { name: string; calories: string };
type LogTab = "workout" | "nutrition" | "wellness";
type MainMode = "log" | "feed";
type PostType = "Workout" | "Nutrition" | "Wellness" | "Achievement" | "Other";

const MOOD_EMOJIS = ["??", "??", "??", "??", "??"];
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

  // Wellness state
  const [wellnessType, setWellnessType] = useState("Yoga");
  const [wellnessDuration, setWellnessDuration] = useState("");
  const [wellnessNotes, setWellnessNotes] = useState("");
  const [mood, setMood] = useState("");

  // Feed state
  const [feedPhoto, setFeedPhoto] = useState<string | null>(null);
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

  async function uploadPhoto(base64DataUrl: string, bucket: string, folder: string): Promise<string | null> {
    try {
      const base64 = base64DataUrl.split(',')[1];
      const mimeMatch = base64DataUrl.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpg';
      const filename = `${folder}/${Date.now()}.${ext}`;
      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: mime });
      const { data, error } = await supabase.storage.from(bucket).upload(filename, blob, { contentType: mime, upsert: true });
      if (error || !data) return null;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch { return null; }
  }

  async function handleSave() {
    if (!user) {
      setSaveError("You must be logged in. Please refresh and sign in again.");
      return;
    }
    setLoading(true);
    setSaveError(null);

    // Ensure user profile row exists (foreign key guard)
    const profileOk = await ensureProfile();
    if (!profileOk) {
      setSaveError("Could not verify your profile. Please refresh and try again.");
      setLoading(false);
      return;
    }

    const base = { user_id: user.id, is_public: !isPrivate, logged_at: new Date().toISOString() };
    let error: any = null;

    try {
      if (logTab === 'workout') {
        const woPhotoUrl = woPhoto ? await uploadPhoto(woPhoto, 'activity', user.id + '/workout') : null;
        const res = await supabase.from('activity_logs').insert({
          ...base,
          log_type: 'workout',
          workout_type: woType || null,
          workout_duration_min: woDuration ? parseInt(woDuration) : null,
          workout_calories: woCalories ? parseInt(woCalories) : null,
          exercises: exercises.length > 0 ? exercises : null,
          cardio: cardioType ? [{ type: cardioType, duration: cardioDuration, distance: cardioDistance }] : null,
          notes: woNotes || null,
          photo_url: woPhotoUrl || null,
        });
        error = res.error;
      } else if (logTab === 'nutrition') {
        const nutPhotoUrl = nutPhoto ? await uploadPhoto(nutPhoto, 'activity', user.id + '/nutrition') : null;
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
          photo_url: nutPhotoUrl || null,
        });
        error = res.error;
      } else if (logTab === 'wellness') {
        const res = await supabase.from('activity_logs').insert({
          ...base,
          log_type: 'wellness',
          wellness_type: wellnessType,
          wellness_duration_min: wellnessDuration ? parseInt(wellnessDuration) : null,
          mood: mood || null,
          notes: wellnessNotes || null,
        });
        error = res.error;
      }
    } catch (e: any) {
      error = { message: e?.message || "Network error. Check your connection and try again." };
    }

    setLoading(false);
    if (error) {
      setSaveError(error.message || "Something went wrong. Please try again.");
    } else {
      setSaved(true);
    }
  }

  async function handlePost() {
    if (!user) {
      setSaveError("You must be logged in. Please refresh and sign in again.");
      return;
    }
    setLoading(true);
    setSaveError(null);

    const profileOk = await ensureProfile();
    if (!profileOk) {
      setSaveError("Could not verify your profile. Please refresh and try again.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        caption: caption || null,
        post_type: postType.toLowerCase() as any,
        location: location || null,
        is_public: true,
      });
      setLoading(false);
      if (error) {
        setSaveError(error.message || "Something went wrong. Please try again.");
      } else {
        setPosted(true);
      }
    } catch (e: any) {
      setLoading(false);
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
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{isPrivate ? "?? Private" : "?? Public on Profile"}</div>
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
        <div style={{ fontSize: 64 }}>?</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.blue }}>Saved to Log!</div>
        <div style={{ fontSize: 14, color: C.sub, marginTop: 8 }}>{isPrivate ? "?? Saved privately" : "?? Visible on your profile"}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Taking you to your profile...</div>
      </div>
    );
  }

  if (posted) {
    setTimeout(() => router.push("/feed"), 1500);
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 64 }}>??</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.blue }}>Posted to Feed!</div>
        <div style={{ fontSize: 14, color: C.sub, marginTop: 8 }}>?? Visible to your followers</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Taking you to the feed...</div>
      </div>
    );
  }

  const TAB_DEFS = [
    { key: "workout" as LogTab, icon: "??", label: "Workout", color: "#16A34A" },
    { key: "nutrition" as LogTab, icon: "??", label: "Nutrition", color: "#F59E0B" },
    { key: "wellness" as LogTab, icon: "??", label: "Wellness", color: "#7C3AED" },
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
          {mainMode === "log" ? "?? Log Activity" : "?? Share to Feed"}
        </div>
        <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: `2px solid ${C.greenMid}`, marginBottom: 10, background: C.greenLight }}>
          {(["log", "feed"] as MainMode[]).map(m => (
            <button key={m} onClick={() => setMainMode(m)} style={{
              flex: 1, padding: "11px 0", fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer",
              background: mainMode === m ? `linear-gradient(135deg,${C.blue},#22C55E)` : "transparent",
              color: mainMode === m ? "#fff" : C.sub, transition: "all 0.2s",
            }}>
              {m === "log" ? "?? Log Activity" : "?? Share to Feed"}
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

        {/* -- Desktop sidebar -- */}
        <div className="post-sidebar">
          <div style={{ fontWeight: 900, fontSize: 15, color: C.text, marginBottom: 24, letterSpacing: -0.3 }}>FIT ?</div>

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
                {m === "log" ? "?? Log Activity" : "?? Share to Feed"}
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
              ? "?? Public by default — visible on your profile. Toggle private per-entry."
              : "?? Posted to your followers' feed."}
          </div>
        </div>

        {/* -- Main content -- */}
        <div className="post-main" style={{ padding: "24px 20px" }}>
        {mainMode === "log" ? (<>

          {/* --- WORKOUT TAB --- */}
          {logTab === "workout" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>?? Workout Details</div>
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
                    <input style={iStyle} type="text" placeholder="e.g. 450" value={woCalories} onChange={e => setWoCalories(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Exercises table */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Exercises</div>
                  <button onClick={() => setExercises(ex => [...ex, { name: "", sets: "3", reps: "10", weight: "" }])}
                    style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.blue}`, background: C.greenLight, color: C.blue, cursor: "pointer" }}>
                    + Add Row
                  </button>
                </div>
                {exercises.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.sub, fontSize: 13 }}>No exercises yet — click + Add Row</div>
                ) : (<>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 80px 36px", gap: 8, marginBottom: 8 }}>
                    {["Exercise", "Sets", "Reps", "Weight", ""].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</span>
                    ))}
                  </div>
                  {exercises.map((ex, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 80px 36px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                      <input style={iStyle} placeholder="Name" value={ex.name} onChange={e => setExercises(exs => exs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                      <input style={iStyle} type="text" value={ex.sets} onChange={e => setExercises(exs => exs.map((x, j) => j === i ? { ...x, sets: e.target.value } : x))} />
                      <input style={iStyle} type="text" value={ex.reps} onChange={e => setExercises(exs => exs.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} />
                      <input style={iStyle} placeholder="lbs" value={ex.weight} onChange={e => setExercises(exs => exs.map((x, j) => j === i ? { ...x, weight: e.target.value } : x))} />
                      <button onClick={() => setExercises(exs => exs.filter((_, j) => j !== i))} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#FFE8E8", color: "#FF4444", fontSize: 18, cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </>)}
              </div>

              {/* Cardio */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>?? Cardio (optional)</div>
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
                      <div style={{ fontSize: 28, marginBottom: 6 }}>??</div>
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
                {loading ? "Saving..." : "?? Save to Log"}
              </button>
            </div>
          )}

          {/* --- NUTRITION TAB --- */}
          {logTab === "nutrition" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>?? Meal Details</div>
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
                    <input style={iStyle} type="text" placeholder="kcal" value={item.calories} onChange={e => setFoodItems(f => f.map((x, j) => j === i ? { ...x, calories: e.target.value } : x))} />
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
                      <input style={iStyle} type="text" placeholder="0" value={f.v} onChange={e => f.s(e.target.value)} />
                    </div>
                  ))}
                </div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Water Intake</label>
                <input style={iStyle} placeholder="e.g. 80 oz or 2L" value={water} onChange={e => setWater(e.target.value)} />
              </div>

              {/* Notes & Photo */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>Notes & Photo</div>
                <textarea rows={3} style={{ ...iStyle, resize: "none", marginBottom: 14 }} placeholder="Meal notes..." value={nutNotes} onChange={e => setNutNotes(e.target.value)} />
                <label style={{ display: "block", cursor: "pointer" }}>
                  {nutPhoto ? (
                    <img src={nutPhoto} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 14, display: "block" }} alt="" />
                  ) : (
                    <div style={{ border: `2px dashed ${C.greenMid}`, borderRadius: 14, padding: "20px 0", textAlign: "center", background: C.greenLight }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>??</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>Meal photos go to nutrition gallery only</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Private — not shared to feed</div>
                    </div>
                  )}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => loadPhoto(e, setNutPhoto)} />
                </label>
              </div>

              <SaveErrorBanner />
              <PrivacyToggle />
              <button onClick={handleSave} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading ? C.greenMid : `linear-gradient(135deg,${C.blue},#22C55E)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving..." : "?? Save to Log"}
              </button>
            </div>
          )}

          {/* --- WELLNESS TAB --- */}
          {logTab === "wellness" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>?? Wellness Activity</div>
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

              <SaveErrorBanner />
              <PrivacyToggle />
              <button onClick={handleSave} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading ? C.greenMid : `linear-gradient(135deg,${C.blue},#22C55E)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving..." : "?? Save to Log"}
              </button>
            </div>
          )}

        </>) : (

          /* --- SHARE TO FEED --- */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Big photo upload */}
            <label style={{ display: "block", cursor: "pointer" }}>
              {feedPhoto ? (
                <img src={feedPhoto} style={{ width: "100%", height: 340, objectFit: "cover", borderRadius: 22, display: "block" }} alt="" />
              ) : (
                <div style={{ border: `2px dashed ${C.greenMid}`, borderRadius: 22, height: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.greenLight, gap: 12 }}>
                  <div style={{ fontSize: 56 }}>??</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.blue }}>Add Photo or Video</div>
                  <div style={{ fontSize: 13, color: C.sub }}>Tap to upload from your device</div>
                </div>
              )}
              <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={e => loadPhoto(e, setFeedPhoto)} />
            </label>

            {/* Post type pills */}
            <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Post Type</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {POST_TYPES.map(t => (
                  <button key={t} onClick={() => setPostType(t)} style={{
                    padding: "8px 18px", borderRadius: 20,
                    border: `2px solid ${postType === t ? C.blue : C.greenMid}`,
                    background: postType === t ? C.blue : C.greenLight,
                    color: postType === t ? "#fff" : C.sub,
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    transition: "all 0.15s",
                  }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption + details */}
            <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}`, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Caption</label>
                <textarea rows={4} style={{ ...iStyle, resize: "none" }} placeholder="Share what you crushed today... ??" value={caption} onChange={e => setCaption(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Tag People</label>
                <input style={iStyle} placeholder="@mention someone" value={tagPeople} onChange={e => setTagPeople(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Location</label>
                <input style={iStyle} placeholder="Add location..." value={location} onChange={e => setLocation(e.target.value)} />
              </div>
            </div>

            <button onClick={handlePost} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: `linear-gradient(135deg,${C.blue},#22C55E)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
              Post to Feed ??
            </button>
          </div>
        )}
        </div>{/* end post-main */}
      </div>{/* end post-layout */}
    </div>
  );
}
