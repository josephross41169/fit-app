"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { compressImage } from "@/lib/compressImage";
import { track } from "@/components/PostHogProvider";
import AIFoodScanner from "@/components/AIFoodScanner";
import { EXERCISES } from "@/lib/exercises";
import { syncGroupChallengeProgressFor } from "@/lib/groupGoalSync";
import { BADGES } from "@/lib/badges";
import { awardXp } from "@/lib/xp";

import { FitbitConnect } from "@/components/FitbitConnect";
import { FitbitActivityCard } from "@/components/FitbitActivityCard";

const C = {
  blue: "#7C3AED",
  greenLight: "#1A1228",
  greenMid: "#2D1B69",
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

type Exercise = { name: string; sets: string; reps: string; weight: string; weights: string[]; notes?: string };
type PrevSet = { weight: string; reps: string };
type PrevSession = { date: string; sets: PrevSet[] };
type FoodItem = { name: string; calories: string; protein?: string; carbs?: string; fat?: string; servingSize?: string; qty?: string };
type NutritionGoals = { calories: number; protein: number; carbs: number; fat: number; water_oz: number; monthly_calories?: number; monthly_protein?: number; monthly_carbs?: number; monthly_fat?: number };
type DailyTotals = { calories: number; protein: number; carbs: number; fat: number; water_oz: number };
type LogTab = "workout" | "nutrition" | "wellness";
type MainMode = "log" | "feed";
type PostType = "Workout" | "Nutrition" | "Wellness" | "Achievement" | "Other";
type WorkoutTemplate = { id: string; name: string; exercises: Exercise[] };
type PRResult = { exercise: string; weight: number; reps: number; isNew: boolean };

// -- Exercise Search Autocomplete Component ----------------------------------
function ExerciseSearchInput({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (name: string) => void;
  style: React.CSSProperties;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<typeof EXERCISES>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  function search(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    const lower = q.toLowerCase();
    const matches = EXERCISES.filter(e =>
      e.name.toLowerCase().includes(lower) ||
      e.category.toLowerCase().includes(lower) ||
      e.muscles.some(m => m.toLowerCase().includes(lower))
    ).slice(0, 8);
    setResults(matches);
    setOpen(matches.length > 0);
  }

  function select(name: string) {
    setQuery(name);
    onChange(name);
    setResults([]);
    setOpen(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <input
        style={style}
        placeholder="Search exercise or muscle..."
        value={query}
        onChange={e => search(e.target.value)}
        onFocus={() => query.length >= 2 && results.length > 0 && setOpen(true)}
        onBlur={() => { if (query && query !== value) onChange(query); }}
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#1A1228', border: '1.5px solid #7C3AED', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(124,58,237,0.25)', overflow: 'hidden', marginTop: 4,
        }}>
          {results.map((ex, i) => (
            <button
              key={i}
              onMouseDown={() => select(ex.name)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', border: 'none', background: 'transparent',
                cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #2D1B69' : 'none',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: '#F0F0F0' }}>{ex.name}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                {ex.category} · {ex.equipment} · {ex.muscles[0]}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Open Food Facts Search Component ---------------------------------------
type FoodSearchResult = {
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
};

function FoodSearchInput({
  onSelect,
}: {
  onSelect: (food: FoodSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=8&fields=product_name,nutriments,serving_size,brands`;
        const res = await fetch(url, { headers: { 'User-Agent': 'FitApp/1.0 (support@liveleeapp.com)' } });
        const data = await res.json();
        const products: FoodSearchResult[] = (data.products || [])
          .filter((p: any) => p.product_name && p.nutriments)
          .map((p: any) => {
            const n = p.nutriments;
            const cal = n['energy-kcal_100g'] || n['energy_100g'] ? Math.round((n['energy-kcal_100g'] || n['energy_100g'] / 4.184)) : 0;
            return {
              name: p.product_name || 'Unknown',
              brand: p.brands || '',
              calories: cal,
              protein: Math.round((n.proteins_100g || 0) * 10) / 10,
              carbs: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
              fat: Math.round((n.fat_100g || 0) * 10) / 10,
              servingSize: p.serving_size || '100g',
            };
          })
          .filter((p: FoodSearchResult) => p.calories > 0 || p.protein > 0);
        setResults(products.slice(0, 8));
        setOpen(products.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      }
      setSearching(false);
    }, 300);
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: 14 }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{
            background: "#111111", border: "1.5px solid #2D1B69", borderRadius: 10,
            padding: "9px 12px 9px 38px", fontSize: 14, color: "#F0F0F0", outline: "none",
            width: "100%", boxSizing: "border-box" as const,
          }}
          placeholder="🔍 Search food database (e.g. chicken breast, oats)..."
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>
          {searching ? '⌛' : '🔍'}
        </div>
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#1A1228', border: '1.5px solid #7C3AED', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(124,58,237,0.25)', overflow: 'hidden', marginTop: 4,
        }}>
          {results.map((food, i) => (
            <button
              key={i}
              onMouseDown={() => { onSelect(food); setQuery(''); setOpen(false); setResults([]); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', border: 'none', background: 'transparent',
                cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #2D1B69' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#F0F0F0' }}>{food.name}</div>
                  {food.brand && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{food.brand}</div>}
                  <div style={{ fontSize: 11, color: '#A78BFA', marginTop: 2 }}>
                    per {food.servingSize} · {food.protein}g P · {food.carbs}g C · {food.fat}g F
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#F5A623', flexShrink: 0, marginLeft: 12 }}>
                  {food.calories} cal
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Standardized workout categories — the source of truth for stats, badges, rivalries.
// Each category defines which detail fields the form should show.
//    distance: show a distance input (mi/km/laps/meters)
//    pace:     auto-compute and display pace from distance/duration
//    sets:     show the full exercises/sets/reps/weight UI
//    paceUnit: how to label the auto-computed pace
type WorkoutCategory = {
  id: string;        // stored in workout_category column
  label: string;     // shown in dropdown
  emoji: string;
  distance?: boolean;
  distanceUnit?: string;
  pace?: boolean;
  paceUnit?: string;
  sets?: boolean;
};

const WORKOUT_CATEGORIES: WorkoutCategory[] = [
  { id: "running",  label: "Running",  emoji: "🏃", distance: true,  distanceUnit: "miles", pace: true, paceUnit: "min/mi"   },
  { id: "walking",  label: "Walking",  emoji: "🚶", distance: true,  distanceUnit: "miles" },
  { id: "biking",   label: "Biking",   emoji: "🚴", distance: true,  distanceUnit: "miles", pace: true, paceUnit: "mph"      },
  { id: "swimming", label: "Swimming", emoji: "🏊", distance: true,  distanceUnit: "yards", pace: true, paceUnit: "min/100yd"},
  { id: "rowing",   label: "Rowing",   emoji: "🚣", distance: true,  distanceUnit: "meters" },
  { id: "lifting",  label: "Lifting",  emoji: "🏋️", sets: true                                                               },
  { id: "hiit",     label: "HIIT",     emoji: "🔥",                                                                           },
  { id: "yoga",     label: "Yoga",     emoji: "🧘",                                                                           },
  { id: "pilates",  label: "Pilates",  emoji: "🤸",                                                                           },
  { id: "boxing",   label: "Boxing",   emoji: "🥊",                                                                           },
  { id: "sports",   label: "Sports",   emoji: "🏀",                                                                           },
  { id: "other",    label: "Other",    emoji: "💪", distance: true,  distanceUnit: "miles", sets: true                        },
];

// Wellness kept for recovery / mindfulness / passive activities. Yoga and
// Walking moved to workout categories since they burn calories and improve
// fitness. Sleep stays here — it's tracking, not exercise.
// ── Wellness types grouped into categories ─────────────────────────────────
// Grouped for the <optgroup> display in the wellness picker. Order within each
// group reflects rough popularity. The flat WELLNESS_TYPES list (kept for
// backwards compat with anywhere else that imports it) is the union of all groups.
const WELLNESS_GROUPS: { label: string; types: string[] }[] = [
  { label: "🌬️ Recovery & Therapy", types: [
    "Cold Plunge", "Sauna", "Infrared Sauna", "Steam Room", "Red Light Therapy",
    "Hyperbaric Oxygen", "Cryotherapy", "Compression Therapy", "Massage",
    "Chiropractic", "Float Tank", "Acupuncture", "Cupping",
  ]},
  { label: "🧘 Mind & Stress", types: [
    "Meditation", "Breathwork", "Yoga Nidra", "Journaling", "Therapy", "Sound Bath",
  ]},
  { label: "🛌 Sleep & Rest", types: ["Sleep", "Nap"] },
  { label: "🤸 Mobility & Bodywork", types: ["Stretching", "Foam Rolling", "Mobility Work"] },
  { label: "🍽️ Diet & Body", types: ["Fasting", "Hydration Goal"] },
  { label: "☀️ Outdoor & Light", types: ["Sunlight Exposure", "Grounding", "Nature Walk"] },
  { label: "Other", types: ["Other"] },
];
const WELLNESS_TYPES = WELLNESS_GROUPS.flatMap(g => g.types);
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout", "Post-workout"];
const POST_TYPES: PostType[] = ["Workout", "Nutrition", "Wellness", "Achievement", "Other"];

export default function PostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mainMode, setMainMode] = useState<MainMode>("log");
  const [logTab, setLogTab] = useState<LogTab>("workout");
  const [saved, setSaved] = useState(false);
  const [posted, setPosted] = useState(false);
  // Newly-awarded badge IDs from the auto-award engine. Set after a successful
  // activity log; the saved-confirmation screen reads this to render a toast
  // celebrating new tier unlocks.
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submittingRef = useRef(false); // hard lock · prevents double-submit even with rapid clicks

  // Workout state
  const [woCategory, setWoCategory] = useState("lifting"); // primary category; drives stats/badges/rivalries
  const [woType, setWoType] = useState("");                 // user-facing workout NAME ("Push Day A")
  // Optional time of day the workout actually happened. Stored as "HH:MM"
  // (24h). When empty, save uses now(). When set, save uses today's date at
  // that time so the activity card and feed show the correct time.
  const [woTime, setWoTime] = useState("");
  // Optional date the workout actually happened. Stored as "YYYY-MM-DD".
  // Empty = today (current behavior). When set, save uses that date.
  // Validated to be within the last 3 calendar days. Set up below in
  // the UI block — woDateMin / woDateMax build the picker bounds.
  const [woDate, setWoDate] = useState("");
  const [woDuration, setWoDuration] = useState("");
  const [woDistance, setWoDistance] = useState("");         // distance for cardio categories
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [prevSessions, setPrevSessions] = useState<Record<string, PrevSession | null>>({});
  const [cardioType, setCardioType] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [woNotes, setWoNotes] = useState("");
  const [woPhoto, setWoPhoto] = useState<string | null>(null);

  // Combined-workout toggles — when on, the form shows BOTH a cardio block
  // and an exercises block in the same workout entry. Lets users log
  // "ran 2 miles AND did chest day" as one log instead of two.
  // Cardio block uses cardioSubcategory + cardioBlockDuration + cardioBlockDistance
  // (decoupled from woCategory/woDuration/woDistance which now serve "single mode")
  const [includeCardio, setIncludeCardio] = useState(false);
  const [includeLifting, setIncludeLifting] = useState(true);
  const [cardioSubcategory, setCardioSubcategory] = useState<string>("running");
  const [cardioBlockDuration, setCardioBlockDuration] = useState("");
  const [cardioBlockDistance, setCardioBlockDistance] = useState("");
  // Duration for the "Or a different type" block (HIIT/yoga/sports/etc).
  // Kept separate from woDuration (which is the lifting block's duration)
  // so users can have BOTH "Sports + Lifting" with independent times.
  const [otherTypeDuration, setOtherTypeDuration] = useState("");

  // ── AI Plan import state ──────────────────────────────────────────────
  // The AI Plan page persists the most recent plan to localStorage when
  // the user generates one. We read it here so users can import any of
  // the plan's training days as a starting point for their workout post.
  // After import, `loadedPlanLabel` shows a banner identifying the day.
  const [aiPlan, setAiPlan] = useState<any | null>(null);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [loadedPlanLabel, setLoadedPlanLabel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("fit_ai_plan");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.plan) setAiPlan(saved.plan);
      }
    } catch { /* corrupt cache, ignore */ }
  }, []);

  // PR + Template state
  const [newPRs, setNewPRs] = useState<PRResult[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  // Today's workout resume state
  const [todayLog, setTodayLog] = useState<{ id: string; type: string } | null>(null);
  const [todayLogId, setTodayLogId] = useState<string | null>(null);

  // Nutrition state
  const [mealType, setMealType] = useState("Breakfast");
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [water, setWater] = useState("");
  const [nutNotes, setNutNotes] = useState("");
  const [nutPhoto, setNutPhoto] = useState<string | null>(null);
  // AI food scanner modal state. When open, shows the photo→nutrition flow.
  const [showAIScanner, setShowAIScanner] = useState(false);
  const [mealPhotos, setMealPhotos] = useState<Record<string, string>>({});
  // Macro goals & daily tracking
  const [macroGoals, setMacroGoals] = useState<NutritionGoals | null>(null);
  const [dailyTotals, setDailyTotals] = useState<DailyTotals | null>(null);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [showGoalsEditor, setShowGoalsEditor] = useState(false);
  const [editGoals, setEditGoals] = useState<NutritionGoals>({ calories: 2500, protein: 180, carbs: 250, fat: 70, water_oz: 100 });

  // Wellness state — supports multiple activities at once. Each entry in
  // `wellnessActivities` becomes its own activity_logs row on save, all
  // sharing the same logged_at + is_public + notes + photo. Sleep + Fasting
  // are handled as special-case dedicated activities (see below) since they
  // have richer data (hours+quality+bedtime / fasting hours).
  type WellnessEntry = { id: string; type: string; duration: string };
  const [wellnessActivities, setWellnessActivities] = useState<WellnessEntry[]>([
    { id: `w-${Date.now()}`, type: "Meditation", duration: "" }
  ]);
  const [wellnessNotes, setWellnessNotes] = useState("");
  const [wellnessPhotoUrl, setWellnessPhotoUrl] = useState<string | null>(null);
  // Extended wellness tracking fields — only relevant when a Sleep or
  // Fasting entry is in the activities list. Sleep/Fasting can each only
  // appear ONCE per save (enforced in UI).
  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [sleepBedtime, setSleepBedtime] = useState("");
  const [sleepWakeTime, setSleepWakeTime] = useState("");
  const [steps, setSteps] = useState("");
  const [hrv, setHrv] = useState("");
  const [restingHR, setRestingHR] = useState("");
  const [fastingHours, setFastingHours] = useState("");

  // Convenience derived flags — used by the UI to know whether to render
  // the Sleep and Fasting detail panels.
  const hasSleep = wellnessActivities.some(a => a.type === 'Sleep');
  const hasFasting = wellnessActivities.some(a => a.type === 'Fasting');

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

  // Fetch previous session data for an exercise name
  const fetchPrevSession = useCallback(async (exerciseName: string) => {
    if (!user || !exerciseName || prevSessions[exerciseName] !== undefined) return;
    // Mark as loading (null = checked, no data)
    setPrevSessions(ps => ({ ...ps, [exerciseName]: null }));
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('exercises, logged_at')
        .eq('user_id', user.id)
        .eq('log_type', 'workout')
        .not('exercises', 'is', null)
        .order('logged_at', { ascending: false })
        .limit(20);
      if (!data) return;
      // Find most recent log that has this exercise
      for (const log of data) {
        const exArray: any[] = log.exercises || [];
        const match = exArray.find((e: any) =>
          (e.name || '').toLowerCase() === exerciseName.toLowerCase()
        );
        if (match) {
          const sets: PrevSet[] = [];
          if (match.weights && Array.isArray(match.weights) && match.weights.length > 0) {
            match.weights.forEach((w: string, idx: number) => {
              sets.push({ weight: w || match.weight || '', reps: match.reps || '' });
            });
          } else {
            const numSets = parseInt(match.sets) || 1;
            for (let i = 0; i < numSets; i++) {
              sets.push({ weight: match.weight || '', reps: match.reps || '' });
            }
          }
          const dateStr = new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          setPrevSessions(ps => ({ ...ps, [exerciseName]: { date: dateStr, sets } }));
          return;
        }
      }
    } catch {}
  }, [user, prevSessions]);

  // -- Import a training day from the AI Plan ------------------------------
  // Pulls a TrainingDay's exercises into the form. Sets all sets to the
  // AI's suggestion, reps too. Weight is left blank — the AI doesn't know
  // the user's weight, so the user fills that in based on what they
  // actually lifted. Per-set weights array is initialized to empty strings
  // matching the planned set count.
  const importPlanDay = useCallback((day: any) => {
    if (!day || !Array.isArray(day.exercises)) return;
    const newExercises: Exercise[] = day.exercises.map((ex: any) => {
      const sets = String(ex.sets || 3);
      const setCount = parseInt(sets) || 3;
      // For "8-12" style rep ranges, take the lower bound as the starting
      // value so users can edit up if they hit the higher end.
      const repsRaw: string = String(ex.reps || "10");
      const repStart = repsRaw.includes("-") ? repsRaw.split("-")[0].trim() : repsRaw;
      return {
        name: ex.name || "",
        sets,
        reps: repStart,
        weight: "",
        weights: Array(setCount).fill(""),
        notes: ex.notes || "",
      };
    });
    setExercises(newExercises);
    setIncludeLifting(true);
    setIncludeCardio(false);
    setWoCategory("lifting");
    if (!woType) setWoType(day.label || day.focus || "AI Plan Workout");
    setLoadedPlanLabel(day.label || `Day ${day.dayNum}`);
    setShowPlanPicker(false);
  }, [woType]);

  // -- Fetch templates on first open ----------------------------------------
  const fetchTemplates = useCallback(async () => {
    if (!user || templatesLoaded) return;
    setTemplatesLoaded(true);
    try {
      const { data } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setTemplates(data as WorkoutTemplate[]);
    } catch {}
  }, [user, templatesLoaded]);

  // -- Fetch today's workout log (for resume banner) -----------------------
  const fetchTodayWorkout = useCallback(async () => {
    if (!user || todayLog !== null) return;
    try {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const { data } = await supabase
        .from('activity_logs')
        .select('id, workout_category, workout_type, exercises, workout_duration_min, notes, cardio')
        .eq('user_id', user.id)
        .eq('log_type', 'workout')
        .gte('logged_at', start)
        .lt('logged_at', end)
        .order('logged_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setTodayLog({ id: data.id, type: data.workout_type || 'Workout' });
    } catch {}
  }, [user, todayLog]);

  // Resume today's workout · pre-loads all existing data into the form
  async function resumeTodayWorkout() {
    if (!user || !todayLog) return;
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('id, workout_category, workout_type, exercises, workout_duration_min, notes, cardio')
        .eq('id', todayLog.id)
        .single();
      if (!data) return;
      setTodayLogId(data.id);
      setWoCategory(data.workout_category || 'lifting');
      setWoType(data.workout_type || '');
      // Route the stored duration into the correct field. For "other type"
      // categories (sports/HIIT/yoga/etc.) the duration belongs in
      // otherTypeDuration; for cardio/lifting it goes in woDuration.
      const isOtherCat = !["running","walking","biking","swimming","rowing","lifting"].includes(data.workout_category || 'lifting');
      const durStr = data.workout_duration_min ? String(data.workout_duration_min) : '';
      if (isOtherCat) {
        setOtherTypeDuration(durStr);
        setWoDuration('');
      } else {
        setWoDuration(durStr);
        setOtherTypeDuration('');
      }
      setWoNotes(data.notes || '');
      // If the stored cardio array has a distance, restore it into the new single-distance field
      const firstCardio = Array.isArray(data.cardio) ? data.cardio[0] : null;
      if (firstCardio && (firstCardio.miles || firstCardio.distance)) {
        setWoDistance(String(firstCardio.miles ?? firstCardio.distance ?? ''));
      }
      // Restore exercises with per-set weights
      const exs: Exercise[] = (data.exercises || []).map((ex: any) => ({
        name: ex.name || '',
        sets: String(ex.sets || 3),
        reps: String(ex.reps || 10),
        weight: ex.weight || '',
        weights: Array.isArray(ex.weights) && ex.weights.length > 0
          ? ex.weights
          : Array(parseInt(String(ex.sets)) || 3).fill(ex.weight || ''),
        notes: ex.notes || '',
      }));
      setExercises(exs);
      // Restore cardio
      if (data.cardio && data.cardio.length > 0) {
        setCardioType(data.cardio[0].type || '');
        setCardioDuration(data.cardio[0].duration || '');
        setCardioDistance(data.cardio[0].distance || '');
      }
      // Restore toggle state for combined workouts. The block fields take
      // precedence over the legacy single-category state for the new UI.
      const hasCardio = !!(data.cardio && data.cardio.length > 0 && (data.cardio[0].duration || data.cardio[0].distance || data.cardio[0].miles));
      const hasExercises = exs.length > 0;
      const cardioCats = ["running","walking","biking","swimming","rowing"];
      // If saved as a cardio category in single-mode, toggle includeCardio on and copy fields into block state
      if (cardioCats.includes(data.workout_category) && !hasExercises) {
        setIncludeCardio(true);
        setIncludeLifting(false);
        setCardioSubcategory(data.workout_category);
        setCardioBlockDuration(data.workout_duration_min ? String(data.workout_duration_min) : '');
        setCardioBlockDistance(firstCardio ? String(firstCardio.miles ?? firstCardio.distance ?? '') : '');
      } else if (hasCardio && hasExercises) {
        // Combined workout — both blocks active
        setIncludeCardio(true);
        setIncludeLifting(true);
        setCardioSubcategory(data.cardio[0].type || 'running');
        setCardioBlockDuration(data.cardio[0].duration ? String(data.cardio[0].duration) : '');
        setCardioBlockDistance(data.cardio[0].distance ? String(data.cardio[0].distance) : (data.cardio[0].miles ? String(data.cardio[0].miles) : ''));
      } else if (hasExercises) {
        setIncludeCardio(false);
        setIncludeLifting(true);
      }
      setLogTab('workout');
    } catch {}
  }

  useEffect(() => {
    if (user) fetchTodayWorkout();
  }, [user, fetchTodayWorkout]);

  // -- Fetch macro goals + today's nutrition totals --------------------------
  const fetchMacroGoalsAndTotals = useCallback(async () => {
    if (!user || goalsLoaded) return;
    setGoalsLoaded(true);
    try {
      // Fetch user's nutrition goals
      const { data: userData } = await supabase
        .from('users')
        .select('nutrition_goals')
        .eq('id', user.id)
        .single();
      if (userData?.nutrition_goals) {
        setMacroGoals(userData.nutrition_goals as NutritionGoals);
        setEditGoals(userData.nutrition_goals as NutritionGoals);
      }
      // Fetch today's nutrition logs for progress bars
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const { data: todayNut } = await supabase
        .from('activity_logs')
        .select('calories_total, protein_g, carbs_g, fat_g, water_oz')
        .eq('user_id', user.id)
        .eq('log_type', 'nutrition')
        .gte('logged_at', start)
        .lt('logged_at', end);
      if (todayNut && todayNut.length > 0) {
        const totals = todayNut.reduce((acc, log) => ({
          calories: acc.calories + (log.calories_total || 0),
          protein: acc.protein + (log.protein_g || 0),
          carbs: acc.carbs + (log.carbs_g || 0),
          fat: acc.fat + (log.fat_g || 0),
          water_oz: acc.water_oz + (log.water_oz || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0, water_oz: 0 });
        setDailyTotals(totals);
      }
    } catch {}
  }, [user, goalsLoaded]);

  async function saveMacroGoals() {
    if (!user) return;
    try {
      await supabase.from('users').update({ nutrition_goals: editGoals }).eq('id', user.id);
      setMacroGoals(editGoals);
      setShowGoalsEditor(false);
    } catch {}
  }

  // Load template into workout form
  function loadTemplate(tpl: WorkoutTemplate) {
    setExercises(tpl.exercises.map(ex => ({
      ...ex,
      weights: ex.weights && ex.weights.length > 0 ? ex.weights : Array(parseInt(ex.sets) || 3).fill(ex.weight || ''),
    })));
    setTemplateDropdownOpen(false);
  }

  // Save current workout as template
  async function saveTemplate() {
    if (!user || !templateName.trim() || exercises.length === 0) return;
    setTemplateSaving(true);
    try {
      const { data } = await supabase.from('workout_templates').insert({
        user_id: user.id,
        name: templateName.trim(),
        exercises: exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: (ex.weights || [])[0] || ex.weight || '',
          weights: ex.weights || [],
          notes: ex.notes || undefined,
        })),
      }).select().single();
      if (data) {
        setTemplates(t => [data as WorkoutTemplate, ...t]);
        setShowSaveTemplate(false);
        setTemplateName('');
      }
    } catch {}
    setTemplateSaving(false);
  }

  async function deleteTemplate(id: string) {
    await supabase.from('workout_templates').delete().eq('id', id).eq('user_id', user!.id);
    setTemplates(t => t.filter(x => x.id !== id));
  }

  // -- PR Detection · run after saving workout -------------------------------
  async function detectPRs(userId: string, savedExercises: Exercise[]): Promise<PRResult[]> {
    if (!savedExercises || savedExercises.length === 0) return [];
    const prs: PRResult[] = [];
    for (const ex of savedExercises) {
      if (!ex.name) continue;
      // Find best set volume in this submission (weight · reps)
      const reps = parseFloat(ex.reps) || 0;
      const weights = ex.weights && ex.weights.length > 0 ? ex.weights : [ex.weight || ''];
      let bestWeight = 0;
      for (const w of weights) {
        const wNum = parseFloat(w) || 0;
        if (wNum > bestWeight) bestWeight = wNum;
      }
      if (bestWeight <= 0 || reps <= 0) continue;
      const newVolume = bestWeight * reps;
      // Check existing PR for this exercise
      const { data: existing } = await supabase
        .from('personal_records')
        .select('volume, weight, reps')
        .eq('user_id', userId)
        .eq('exercise_name', ex.name)
        .order('volume', { ascending: false })
        .limit(1)
        .maybeSingle();
      const existingVolume = existing?.volume || 0;
      if (newVolume > existingVolume) {
        // New PR! Upsert (insert new record)
        await supabase.from('personal_records').insert({
          user_id: userId,
          exercise_name: ex.name,
          weight: bestWeight,
          reps: reps,
          volume: newVolume,
          logged_at: new Date().toISOString(),
        });
        prs.push({ exercise: ex.name, weight: bestWeight, reps, isNew: !existing });
      }
    }
    return prs;
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

    // Best-effort profile creation · never block the save
    await ensureProfile().catch(() => {});

    // Build logged_at — combine optional date + time fields.
    //   woDate empty + woTime empty → "now"
    //   woDate set + woTime empty → that date at noon (so it doesn't drift to
    //     midnight which can flip days in some timezones)
    //   woDate empty + woTime set → today at that time
    //   woDate set + woTime set → that date at that time
    // Date is validated to be within the last 3 calendar days client-side AND
    // re-validated here as a safety net (a malformed date silently falls back
    // to "now").
    let loggedAtIso = new Date().toISOString();
    if (logTab === 'workout') {
      let baseDate = new Date();
      let dateValid = true;

      if (woDate && /^\d{4}-\d{2}-\d{2}$/.test(woDate)) {
        // Build the date in local timezone (avoid the UTC drift of new Date("YYYY-MM-DD"))
        const [y, m, d] = woDate.split('-').map(Number);
        const candidate = new Date(y, m - 1, d, 12, 0, 0, 0); // noon as default
        // Confirm it's within the allowed 3-day window (today + 3 prior days)
        const today = new Date(); today.setHours(0,0,0,0);
        const minDate = new Date(today); minDate.setDate(today.getDate() - 3);
        if (candidate >= minDate && candidate <= new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)) {
          baseDate = candidate;
        } else {
          dateValid = false;
        }
      }

      if (dateValid && woTime && /^\d{2}:\d{2}$/.test(woTime)) {
        const [hh, mm] = woTime.split(':').map(Number);
        baseDate.setHours(hh, mm, 0, 0);
      }

      // Only override "now" if at least one field was provided AND valid
      if (dateValid && (woDate || woTime)) {
        loggedAtIso = baseDate.toISOString();
      }
    }
    const base = { user_id: user.id, is_public: !isPrivate, logged_at: loggedAtIso };
    let error: any = null;

    try {
      if (logTab === 'workout') {
        // Upload workout photo if present
        let woPhotoUrl: string | null = null;
        if (woPhoto) {
          woPhotoUrl = await uploadPhoto(await compressImage(woPhoto), 'activity', `${user.id}/workout-${Date.now()}.jpg`);
        }
        // Normalize exercises: ensure weights array is stored
        const normalizedExercises = exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: (ex.weights || [])[0] || ex.weight || '',
          weights: ex.weights && ex.weights.length > 0 ? ex.weights : [ex.weight || ''],
          notes: ex.notes || undefined,
        }));

        // ── Build the cardio + exercises payload ─────────────────────────
        // The form has two primary-activity modes:
        //   A) Cardio mode (woCategory ∈ running/walking/biking/swimming/rowing/lifting):
        //      uses the includeCardio + includeLifting toggles. User can fill
        //      one or both blocks.
        //   B) "Other type" mode (woCategory ∈ hiit/yoga/pilates/boxing/sports/other):
        //      duration + notes drive the primary log; the user can ALSO
        //      toggle Lifting on to attach exercises in the same entry.
        //
        // The DB columns (workout_category, exercises, cardio) work for both —
        // the only thing that changes is which fields get populated.
        let cardioPayload: any = null;
        let effectiveWoCategory = woCategory;
        let effectiveDuration: number | null = null;

        // Detect "other type" mode (non-cardio, non-lifting primary category)
        const isOtherTypeMode = !["running","walking","biking","swimming","rowing","lifting"].includes(woCategory);

        if (isOtherTypeMode) {
          // Primary activity = sports/HIIT/yoga/etc. The dedicated
          // otherTypeDuration field drives the primary log duration.
          // Then if lifting is also toggled on, woDuration adds to it.
          effectiveDuration = otherTypeDuration ? parseInt(otherTypeDuration) : null;
          // Add lifting duration on top if user typed one in the lifting block
          if (includeLifting && woDuration) {
            const wd = parseInt(woDuration);
            if (!isNaN(wd)) effectiveDuration = (effectiveDuration || 0) + wd;
          }
          // woCategory stays as-is (sports/hiit/yoga/etc) — that's the
          // primary classifier. We still allow lifting exercises to
          // be attached via includeLifting (handled below in useExercises).
        } else {
          // Cardio-mode — process toggles
          if (includeCardio) {
            const distNum = parseFloat(cardioBlockDistance) || 0;
            const durNum  = parseFloat(cardioBlockDuration)  || 0;
            const cardioEntry: any = {
              type: cardioSubcategory,
              distance: cardioBlockDistance || null,
              duration: cardioBlockDuration || null,
            };
            if (distNum > 0) cardioEntry.miles = distNum;
            if (distNum > 0 && durNum > 0) {
              if (cardioSubcategory === "running") cardioEntry.pace_min_per_mile = durNum / distNum;
              else if (cardioSubcategory === "biking") cardioEntry.mph = (distNum / durNum) * 60;
              else if (cardioSubcategory === "swimming") cardioEntry.pace_min_per_100 = (durNum / distNum) * 100;
            }
            cardioPayload = [cardioEntry];
            effectiveDuration = (effectiveDuration || 0) + (durNum > 0 ? Math.round(durNum) : 0);
          }

          // Set workout_category — primary classifier for badges/stats/rivalries.
          // If both blocks active, lifting wins as the primary (most weight bearing).
          // If only cardio, use the cardio subcategory.
          if (includeLifting) {
            effectiveWoCategory = "lifting";
          } else if (includeCardio) {
            effectiveWoCategory = cardioSubcategory;
          } else {
            effectiveWoCategory = woCategory;
          }
          // Lifting workouts may also have a duration (user can enter it manually)
          if (woDuration) {
            const wd = parseInt(woDuration);
            if (!isNaN(wd)) effectiveDuration = (effectiveDuration || 0) + wd;
          }
        }
        // Allow exercises to attach in BOTH cardio-mode (when includeLifting on)
        // and other-type mode (when includeLifting on alongside e.g. sports).
        const useExercises = includeLifting && normalizedExercises.length > 0;

        const workoutPayload = {
          workout_category: effectiveWoCategory,         // standardized — drives stats/badges/rivalries
          workout_type: woType || null,                  // user's name for this workout ("Push Day A")
          workout_duration_min: effectiveDuration,
          exercises: useExercises ? normalizedExercises : null,
          cardio: cardioPayload,
          notes: woNotes || null,
          photo_url: woPhotoUrl,
          source: 'manual',                              // future wearables will set 'fitbit'/'apple-watch'/etc.
        };
        // Always insert a new row — users can log multiple workouts per day.
        // Group goals, rivalries, challenges, and wars all aggregate by COUNT/SUM
        // across the date window, so each insert is tracked independently.
        const res = await supabase.from('activity_logs').insert({ ...base, log_type: 'workout', ...workoutPayload });
        error = res.error;
      } else if (logTab === 'nutrition') {
        // Upload per-meal photos
        const uploadedMealPhotos: Record<string, string> = {};
        for (const [meal, dataUrl] of Object.entries(mealPhotos)) {
          if (dataUrl) {
            const url = await uploadPhoto(await compressImage(dataUrl), 'activity', `${user.id}/nutrition-${meal.toLowerCase()}-${Date.now()}.jpg`);
            if (url) uploadedMealPhotos[meal] = url;
          }
        }
        // Also upload legacy single photo if set
        let nutPhotoUrl: string | null = null;
        if (nutPhoto) {
          nutPhotoUrl = await uploadPhoto(await compressImage(nutPhoto), 'activity', `${user.id}/nutrition-${Date.now()}.jpg`);
        }
        // Store meal photos as JSON string, or single URL for backward compat
        const photoUrlToStore = Object.keys(uploadedMealPhotos).length > 0
          ? JSON.stringify(uploadedMealPhotos)
          : nutPhotoUrl;
        // Auto-calculate macros from food items if available
        const autoCalNut = foodItems.reduce((s, f) => s + (parseFloat(f.calories) || 0), 0);
        const autoProtNut = foodItems.reduce((s, f) => s + (parseFloat((f as any).protein || '0') || 0), 0);
        const autoCarbsNut = foodItems.reduce((s, f) => s + (parseFloat((f as any).carbs || '0') || 0), 0);
        const autoFatNut = foodItems.reduce((s, f) => s + (parseFloat((f as any).fat || '0') || 0), 0);
        const finalProtein = autoProtNut > 0 ? autoProtNut : (protein ? parseFloat(protein) : null);
        const finalCarbs = autoCarbsNut > 0 ? autoCarbsNut : (carbs ? parseFloat(carbs) : null);
        const finalFat = autoFatNut > 0 ? autoFatNut : (fat ? parseFloat(fat) : null);
        const finalCalories = autoCalNut > 0 ? autoCalNut : null;
        const res = await supabase.from('activity_logs').insert({
          ...base,
          log_type: 'nutrition',
          meal_type: mealType,
          food_items: foodItems.length > 0 ? foodItems : null,
          calories_total: finalCalories,
          protein_g: finalProtein,
          carbs_g: finalCarbs,
          fat_g: finalFat,
          water_oz: water ? parseFloat(water) : null,
          notes: nutNotes || null,
          photo_url: photoUrlToStore,
        });
        error = res.error;
      } else if (logTab === 'wellness') {
        // ── Multi-activity wellness save ─────────────────────────────────
        // Each entry in `wellnessActivities` becomes its own activity_logs
        // row. They all share the same logged_at, is_public, notes, and
        // photo so they group naturally on the profile timeline. Empty
        // entries (no type) are silently dropped.
        const validActivities = wellnessActivities.filter(a => a.type && a.type.trim());
        if (validActivities.length === 0) {
          setSaveError("Add at least one wellness activity before saving.");
          setLoading(false);
          submittingRef.current = false;
          return;
        }

        // Validate Fasting (minimum 12 hours) — applies if Fasting is in the list
        const fastingEntry = validActivities.find(a => a.type === 'Fasting');
        if (fastingEntry) {
          const hours = parseFloat(fastingHours);
          if (!fastingHours.trim() || isNaN(hours)) {
            setSaveError("Enter how many hours you fasted (minimum 12).");
            setLoading(false);
            submittingRef.current = false;
            return;
          }
          if (hours < 12) {
            setSaveError("Fasts under 12 hours don't count — that's just sleeping and breakfast 😅. Remove the fasting entry or fast longer.");
            setLoading(false);
            submittingRef.current = false;
            return;
          }
        }

        // Upload wellness photo once — same URL stored on each row.
        let wellnessUploadedUrl: string | null = null;
        if (wellnessPhotoUrl) {
          wellnessUploadedUrl = await uploadPhoto(await compressImage(wellnessPhotoUrl), 'activity', `${user.id}/wellness-${Date.now()}.jpg`);
        }

        // Build the row for each activity. Sleep + Fasting carry their
        // special detail fields; everything else just uses duration.
        const rows = validActivities.map(act => {
          const row: Record<string, any> = {
            ...base,
            log_type: 'wellness',
            wellness_type: act.type,
            notes: wellnessNotes || null,
            photo_url: wellnessUploadedUrl || null,
          };
          if (act.type === 'Fasting' && fastingHours) {
            row.wellness_duration_min = Math.round(parseFloat(fastingHours) * 60);
          } else if (act.duration && act.duration.trim()) {
            const d = parseInt(act.duration);
            if (!isNaN(d)) row.wellness_duration_min = d;
          }
          // wellness_data column is omitted — requires migration:
          // lib/migration-wellness-data.sql. Sleep / steps / HRV detail
          // fields land here once the column exists.
          return row;
        });

        const res = await supabase.from('activity_logs').insert(rows);
        error = res.error;
      }
    } catch (e: any) {
      error = { message: e?.message || "Network error. Check your connection and try again." };
    }

    setLoading(false);
    if (error) {
      submittingRef.current = false;
      setSaveError(error.message || "Something went wrong. Please try again.");
    } else {
      // -- Auto-award activity badges ----------------------------------------
      // NOTE: now passes woCategory (standardized) so badge-award can reliably
      // detect category (running/lifting/etc.) instead of keyword-matching
      // the free-text workout name. For multi-wellness saves, we pass the
      // first activity's type — the engine pulls actual counts from the DB
      // anyway, so all the wellness rows we just inserted get counted.
      try {
        const firstWellnessType = wellnessActivities.find(a => a.type)?.type || '';
        const awarded = await awardActivityBadges(user.id, logTab, firstWellnessType, cardioType, woType, woCategory, exercises);
        if (awarded && awarded.length > 0) setNewBadges(awarded);
      } catch {}
      // -- Award XP for level system ----------------------------------------
      // Fires once per (user, category) per UTC day — server enforces the cap.
      // Workouts can award MULTIPLE XP categories — if user logged a combined
      // cardio + lifting session, they get BOTH cardio XP AND workout XP that day.
      try {
        const cardioCategories = new Set(["running", "walking", "biking", "swimming", "rowing"]);
        const xpCategoriesToAward: Array<"workout" | "cardio" | "nutrition" | "wellness"> = [];

        if (logTab === "workout") {
          // Combined-mode: cardio toggle + lifting toggle each award their category
          if (includeCardio || includeLifting) {
            if (includeCardio) xpCategoriesToAward.push("cardio");
            if (includeLifting) xpCategoriesToAward.push("workout");
          } else {
            // Single-mode (hiit/yoga/etc.) — fall back to woCategory
            xpCategoriesToAward.push(cardioCategories.has(woCategory) ? "cardio" : "workout");
          }
        } else if (logTab === "nutrition") {
          xpCategoriesToAward.push("nutrition");
        } else if (logTab === "wellness") {
          xpCategoriesToAward.push("wellness");
        }
        for (const cat of xpCategoriesToAward) await awardXp(user.id, cat);
      } catch (e) {
        console.warn("[post] awardXp failed:", e);
      }
      // -- Sync group-challenge progress from activity_logs ------------------
      // Scans the user's active group goals and updates their contribution
      // based on what's actually in activity_logs right now. Best-effort.
      try { await syncGroupChallengeProgressFor(user.id); } catch {}
      // -- PR Detection (workout only) ---------------------------------------
      if (logTab === 'workout' && exercises.length > 0) {
        try {
          const detectedPRs = await detectPRs(user.id, exercises);
          if (detectedPRs.length > 0) setNewPRs(detectedPRs);
        } catch {}
      }
      setSaved(true);
    }
  }

  // -- Badge auto-award engine -----------------------------------------------
  // Called after every successful activity log. Reads the user's counts from
  // activity_logs and awards any new tier badges they've earned.
  //
  // Uses the standardized workout_category column (not free-text workout_type)
  // to reliably identify running / lifting / yoga / etc. Also aware of the
  // expanded 8-tier ladder: 1 / 5 / 20 / 50 / 100 / 200 / 500 / 1000.
  async function awardActivityBadges(
    userId: string,
    tab: LogTab,
    wType: string,
    cType: string,
    woT: string,
    woCat: string,
    exs: any[]
  ) {
    // Pre-fetch existing badge IDs once instead of upserting blindly. The old
    // version did 30+ upserts per save (one per threshold check) and let the
    // DB silently ignore duplicates. This way we know exactly what's NEW so
    // we can toast the user about it after the save completes.
    const { data: existingRows } = await supabase
      .from('badges')
      .select('badge_id')
      .eq('user_id', userId);
    const existing = new Set((existingRows || []).map((r: any) => r.badge_id));

    // Newly-awarded badges (in this save). Collected and returned to caller
    // so the saved-confirmation screen can render a toast.
    const newlyAwarded: string[] = [];

    // Insert helper — only fires DB call when badge is genuinely new.
    async function award(badgeId: string) {
      if (existing.has(badgeId)) return;
      const { error } = await supabase.from('badges').insert({
        user_id: userId,
        badge_id: badgeId,
        note: 'auto',
      });
      if (!error) {
        existing.add(badgeId);
        newlyAwarded.push(badgeId);
      }
    }

    // Count logs matching a filter. Supports eq and ilike via 'ilike:' prefix.
    async function countLogs(filters: Record<string, any>): Promise<number> {
      let q = supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      for (const [key, val] of Object.entries(filters)) {
        if (typeof val === 'string' && val.startsWith('ilike:')) {
          q = (q as any).ilike(key, val.replace('ilike:', ''));
        } else if (typeof val === 'string' && val.startsWith('gte:')) {
          q = (q as any).gte(key, val.replace('gte:', ''));
        } else {
          q = (q as any).eq(key, val);
        }
      }
      const { count } = await q;
      return count || 0;
    }

    // ── Ladder-based auto-award ────────────────────────────────────────────
    // For each ladder family with a counterSource, compute the user's count
    // from activity_logs and award all tier badges they've crossed.

    // Helper — award all tiers up to `count` for a given easy-ladder prefix.
    async function awardLadder(prefix: string, count: number) {
      const thresholds = [1, 5, 20, 50, 100, 200, 500, 1000];
      for (const t of thresholds) {
        if (count >= t) await award(`${prefix}-${t}`);
        else break; // ascending — no point checking higher
      }
    }

    // ── Total Workouts (any log_type='workout') ─────────────────────────
    if (tab === 'workout') {
      const totalWorkouts = await countLogs({ log_type: 'workout' });
      await awardLadder('workouts', totalWorkouts);

      // Per-category ladders. Maps workout_category → ladder prefix.
      // running, walking, biking, swimming, rowing → cardio ladders
      // lifting → lifts ladder
      // yoga, pilates → wellness ladders
      // hiit, boxing, sports → cardio ladders
      const categoryLadders: Record<string, string> = {
        running:  'runs',
        walking:  'walks',
        biking:   'biking',
        swimming: 'swimming',
        rowing:   'rowing',
        lifting:  'lifts',
        yoga:     'yoga',
        pilates:  'pilates',
        hiit:     'hiit',
        boxing:   'boxing',
        sports:   'sports',
      };
      const ladderPrefix = categoryLadders[woCat];
      if (ladderPrefix) {
        const count = await countLogs({ log_type: 'workout', workout_category: woCat });
        await awardLadder(ladderPrefix, count);
      }

      // 5K ladder — running workouts with any cardio entry ≥ 3.1 mi.
      // Recount client-side after each log so tier awards fire correctly.
      if (woCat === 'running') {
        try {
          const { data: runRows } = await supabase
            .from('activity_logs')
            .select('cardio')
            .eq('user_id', userId)
            .eq('log_type', 'workout')
            .eq('workout_category', 'running');
          let fives = 0;
          for (const row of (runRows || []) as any[]) {
            const entries = Array.isArray(row.cardio) ? row.cardio : [];
            if (entries.some((c: any) => (parseFloat(String(c.distance ?? '')) || 0) >= 3.1)) {
              fives++;
            }
          }
          if (fives > 0) await awardLadder('5k', fives);
        } catch { /* non-fatal */ }
      }

      // Early Bird — workouts before 7am (uses created_at hour)
      // Approximation: count workouts where created_at hour is < 7.
      // Postgres function call would be cleaner but we keep it client-side
      // by fetching recent rows and filtering. For now a simple heuristic:
      // skip this check — Early Bird stays manual until we add a counter.
    }

    // ── Wellness ladders ──────────────────────────────────────────────────
    if (tab === 'wellness') {
      const totalWellness = await countLogs({ log_type: 'wellness' });
      await awardLadder('wellness', totalWellness);

      // wellness_type drives sub-ladders. Use ilike for case-insensitive match.
      const wellnessLadders: { types: string[]; prefix: string }[] = [
        { types: ['meditation'],                prefix: 'meditation' },
        { types: ['cold plunge', 'ice bath'],   prefix: 'cold-plunge' },
        // Plain "sauna" matches both Sauna and Infrared Sauna logs since infrared
        // is a sauna variant. The infrared-only ladder below is additional, not exclusive.
        { types: ['sauna'],                     prefix: 'sauna' },
        { types: ['infrared sauna'],            prefix: 'infrared-sauna' },
        { types: ['breathwork'],                prefix: 'breathwork' },
        { types: ['stretching'],                prefix: 'stretching' },
        { types: ['red light'],                 prefix: 'red-light' },
        { types: ['massage'],                   prefix: 'massage' },
        { types: ['float tank'],                prefix: 'float-tank' },
        { types: ['mobility'],                  prefix: 'mobility' },
        { types: ['journaling'],                prefix: 'journaling' },
        { types: ['sunlight', 'grounding'],     prefix: 'sunlight' },
      ];
      for (const wl of wellnessLadders) {
        if (!wl.types.some(t => wType?.toLowerCase().includes(t))) continue;
        // Sum across all matching wellness_type variants
        let count = 0;
        for (const t of wl.types) {
          count += await countLogs({ log_type: 'wellness', wellness_type: `ilike:%${t}%` });
        }
        await awardLadder(wl.prefix, count);
      }

      // Fasting ladder — counts only fasts where wellness_duration_min >= 720
      // (12 hours × 60). Anything shorter is rejected at save time so this is a
      // safety check only. The hours don't affect badge progress beyond crossing
      // the 12h threshold — every qualifying fast counts as one toward the ladder.
      if (wType?.toLowerCase().includes('fasting')) {
        const fastingCount = await countLogs({
          log_type: 'wellness',
          wellness_type: 'ilike:%fasting%',
          wellness_duration_min: 'gte:720',
        });
        await awardLadder('fasting-12h', fastingCount);

        // Also award the existing 24h "Fasting Pro" credential on any 24h+ fast
        const has24h = await countLogs({
          log_type: 'wellness',
          wellness_type: 'ilike:%fasting%',
          wellness_duration_min: 'gte:1440',
        });
        if (has24h > 0) await award('fasting');
      }
    }

    // ── Nutrition ─────────────────────────────────────────────────────────
    if (tab === 'nutrition') {
      const totalNutrition = await countLogs({ log_type: 'nutrition' });
      await awardLadder('nutrition', totalNutrition);
    }

    // ── Posts (always check on any save — posts table separate) ──────────
    {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (count !== null && count !== undefined) await awardLadder('posts', count);
    }

    // ── Followers (separate table) ────────────────────────────────────────
    {
      const { count } = await supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', userId);
      if (count !== null && count !== undefined) await awardLadder('followers', count);
    }

    // ── Strength weight badges (auto-detect from logged exercises) ────────
    // Find heaviest weight per lift type in the just-saved session, plus
    // historical max from previous sessions, then award appropriate tiers.
    if (tab === 'workout' && woCat === 'lifting' && exs.length > 0) {
      // Helper: classify exercise name into bench/squat/deadlift bucket
      function classifyLift(name: string): 'bench' | 'squat' | 'deadlift' | null {
        const n = name.toLowerCase();
        if (n.includes('bench')) return 'bench';
        if (n.includes('squat')) return 'squat';
        if (n.includes('deadlift')) return 'deadlift';
        return null;
      }
      // Find max weight per lift type from current session
      const maxes: Record<string, number> = { bench: 0, squat: 0, deadlift: 0 };
      for (const ex of exs) {
        const bucket = classifyLift(ex.name || ex.exercise || '');
        if (!bucket) continue;
        const sets = ex.sets || [];
        for (const s of sets) {
          const w = Number(s.weight ?? s.weight_lbs ?? 0);
          if (w > maxes[bucket]) maxes[bucket] = w;
        }
      }
      // Award strength tiers if any max crosses threshold
      const weightThresholds = [200, 300, 400, 500];
      for (const [bucket, max] of Object.entries(maxes)) {
        if (max <= 0) continue;
        for (const t of weightThresholds) {
          if (max >= t) await award(`${bucket}-${t}`);
          else break;
        }
      }
      // Total = sum of bench + squat + deadlift max
      const totalLift = maxes.bench + maxes.squat + maxes.deadlift;
      const totalThresholds = [800, 1000, 1300, 1500];
      for (const t of totalThresholds) {
        if (totalLift >= t) await award(`total-${t}`);
        else break;
      }
    }


    return newlyAwarded;
  }

  // uploadPhoto imported from @/lib/uploadPhoto · uses server-side API to bypass storage RLS

  async function handlePost() {
    if (!user) {
      setSaveError("You must be logged in. Please refresh and sign in again.");
      return;
    }
    if (submittingRef.current || loading || posted) return; // hard lock · ref fires before state re-render
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
      const url = await uploadPhoto(await compressImage(photo), 'posts', `${user.id}/${Date.now()}-${uploadedUrls.length}.jpg`);
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
        // Track the feed post for analytics. Properties let us see which
        // post types people are sharing in the PostHog dashboard.
        track("post_created", {
          has_photo: !!mediaUrl,
          photo_count: uploadedUrls.length,
          has_caption: !!caption,
          has_location: !!location,
        });
        // -- Auto-award post badges ------------------------------------------
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
        // -- Award XP for feed post ----------------------------------------
        // 3 XP per day max for posting to feed (server enforces cap)
        try { await awardXp(user.id, "feed_post"); } catch (e) { console.warn("[post] feed_post XP failed:", e); }
        setPosted(true);
        // ref stays true · post is done, we never want another submit
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

  // Inline share button for PR celebration screen
  function SharePRButton({ prExercise, prWeight, prReps, username, displayName }: {
    prExercise?: string; prWeight?: number; prReps?: number; username: string; displayName: string;
  }) {
    const [open, setOpen] = useState(false);
    const ShareCardDyn = require("@/components/ShareCard").default;
    return (
      <>
        {open && <ShareCardDyn
          data={{ type: "pr", username, displayName, prExercise, prWeight, prReps, prBadge: true }}
          onClose={() => setOpen(false)}
        />}
        <button
          onClick={() => setOpen(true)}
          style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #7C3AED, #A78BFA)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
        >
          📤 Share PR Card
        </button>
      </>
    );
  }

  if (saved) {
    const hasPRs = newPRs.length > 0;
    const hasNewBadges = newBadges.length > 0;
    // Give user time to see badge unlocks before auto-redirect. PR screen
    // already requires manual dismiss, but badge-only unlocks need extra time.
    const redirectDelay = hasNewBadges ? 4500 : 1500;
    if (!hasPRs) setTimeout(() => router.push("/profile"), redirectDelay);
    const firstPR = newPRs[0];
    // Look up badge metadata for the awarded IDs (emoji + label)
    const awardedBadgeMeta = newBadges
      .map(id => BADGES.find(b => b.id === id))
      .filter(Boolean) as typeof BADGES;
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 24px" }}>
        {/* ShareCard modal (lazy import avoids SSR issues) */}
        {typeof window !== "undefined" && (() => {
          const [showShare, setShowShare] = ([] as any);
          return null; // handled inline below via local state
        })()}
        <div style={{ fontSize: 64 }}>{hasPRs ? "🏆" : "✓"}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.blue }}>
          {hasPRs ? `${newPRs.length} New PR${newPRs.length > 1 ? "s" : ""}! 🎉` : "Saved to Log!"}
        </div>
        {hasPRs && (
          <div style={{ background: "#1A1228", borderRadius: 18, padding: "16px 20px", width: "100%", maxWidth: 380, border: "2px solid #F5A623" }}>
            {newPRs.map((pr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < newPRs.length - 1 ? "1px solid #2D1B69" : "none" }}>
                <span style={{ fontSize: 22 }}>🏆</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#F5A623" }}>{pr.exercise}</div>
                  <div style={{ fontSize: 12, color: "#A78BFA" }}>{pr.weight}lbs · {pr.reps} reps{pr.isNew ? " · First PR!" : " · New Best!"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Badge unlocks — shown when the auto-award engine returned new
            badges. Card is purple-bordered so it's distinct from PR cards. */}
        {hasNewBadges && awardedBadgeMeta.length > 0 && (
          <div style={{ background: "linear-gradient(135deg,#1A0F30,#2D1B69)", borderRadius: 18, padding: "16px 20px", width: "100%", maxWidth: 380, border: "2px solid #A78BFA", boxShadow: "0 0 24px rgba(167,139,250,0.4)" }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#E9D5FF", marginBottom: 10, letterSpacing: 0.5 }}>
              ✨ {awardedBadgeMeta.length} NEW BADGE{awardedBadgeMeta.length > 1 ? "S" : ""} UNLOCKED!
            </div>
            {awardedBadgeMeta.map((b, i) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < awardedBadgeMeta.length - 1 ? "1px solid #3D2A6E" : "none" }}>
                <span style={{ fontSize: 26 }}>{b.emoji}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>{b.label}</div>
                  <div style={{ fontSize: 12, color: "#A78BFA" }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 14, color: C.sub, marginTop: 8 }}>{isPrivate ? "🔒 Saved privately" : "🌐 Visible on your profile"}</div>
        {hasPRs ? (
          <div style={{ display: "flex", gap: 12, marginTop: 8, width: "100%", maxWidth: 380 }}>
            <SharePRButton
              prExercise={firstPR?.exercise}
              prWeight={firstPR?.weight}
              prReps={firstPR?.reps}
              username={user?.email?.split("@")[0] || "user"}
              displayName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
            />
            <button
              onClick={() => router.push("/profile")}
              style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #2D1F52", background: "#1A1228", color: "#9CA3AF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              View Profile →
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Taking you to your profile...</div>
        )}
      </div>
    );
  }

  if (posted) {
    setTimeout(() => router.push("/feed"), 1500);
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 64 }}>🎉</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.blue }}>Posted to Feed!</div>
        <div style={{ fontSize: 14, color: C.sub, marginTop: 8 }}>🌐 Visible to your followers</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Taking you to the feed...</div>
      </div>
    );
  }

  const TAB_DEFS = [
    { key: "workout" as LogTab, icon: "💪", label: "Workout", color: "#7C3AED" },
    { key: "nutrition" as LogTab, icon: "🥗", label: "Nutrition", color: "#F59E0B" },
    { key: "wellness" as LogTab, icon: "🧘", label: "Wellness", color: "#7C3AED" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 100 }}>
      {/* ── AI Plan picker modal ──
          Shows a list of all training days from the saved AI plan. User
          taps a day → its exercises auto-populate the post form. */}
      {showPlanPicker && aiPlan && (
        <div onClick={() => setShowPlanPicker(false)}
          style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.75)",
            display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background:"#111118", borderRadius:20, padding:"20px 20px 16px",
              maxWidth:480, width:"100%", maxHeight:"80vh", overflowY:"auto",
              border:"1.5px solid #2D1F52",
            }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:900, color:"#F0F0F0" }}>📋 Pick a workout day</div>
                <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>
                  From your {aiPlan.splitName || "AI Plan"} · {aiPlan.goal} · {aiPlan.level}
                </div>
              </div>
              <button onClick={() => setShowPlanPicker(false)}
                style={{ background:"none", border:"none", color:"#9CA3AF", fontSize:24, cursor:"pointer", padding:0, lineHeight:1 }}>×</button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {(aiPlan.days || []).map((day: any, i: number) => (
                <button key={i} onClick={() => importPlanDay(day)}
                  style={{
                    width:"100%", textAlign:"left",
                    padding:"12px 14px", borderRadius:12,
                    background:"rgba(124,58,237,0.10)",
                    border:"1.5px solid rgba(124,58,237,0.35)",
                    color:"#F0F0F0", cursor:"pointer",
                    transition:"all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.20)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.10)"; }}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:14, fontWeight:800, color:"#F0F0F0" }}>
                      Day {day.dayNum} · {day.label}
                    </span>
                    <span style={{ fontSize:11, color:"#A78BFA", fontWeight:700, flexShrink:0 }}>
                      {day.estimatedMinutes}m
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:6 }}>{day.focus}</div>
                  <div style={{ fontSize:11, color:"#6B7280" }}>
                    {(day.exercises || []).length} exercise{(day.exercises || []).length === 1 ? "" : "s"}
                    {(day.exercises || []).slice(0, 3).length > 0 && (
                      <span> · {(day.exercises || []).slice(0, 3).map((ex: any) => ex.name).join(", ")}
                        {(day.exercises || []).length > 3 ? "…" : ""}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop:14, padding:"10px 12px", background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.25)", borderRadius:10 }}>
              <div style={{ fontSize:11, color:"#9CA3AF", lineHeight:1.5 }}>
                💡 The exercises load with AI's suggested sets and reps. Add your actual weights and unmark anything you skipped.
              </div>
            </div>
          </div>
        </div>
      )}

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
            background: #0D0D0D;
            border-right: 2px solid #2D1F52;
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

      {/* Mobile header — safe-top pushes below the iPhone notch/Dynamic Island */}
      <div className="post-mobile-header safe-top" style={{ background: C.white, borderBottom: `2px solid ${C.greenMid}`, padding: "0 20px 0" }}>
        <div style={{ fontWeight: 900, fontSize: 22, color: C.text, marginBottom: 14 }}>
          {mainMode === "log" ? "📋 Log Activity" : "📢 Share to Feed"}
        </div>
        <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: `2px solid ${C.greenMid}`, marginBottom: 10, background: C.greenLight }}>
          {(["log", "feed"] as MainMode[]).map(m => (
            <button key={m} onClick={() => setMainMode(m)} style={{
              flex: 1, padding: "11px 0", fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer",
              background: mainMode === m ? `linear-gradient(135deg,${C.blue},#A78BFA)` : "transparent",
              color: mainMode === m ? "#fff" : C.sub, transition: "all 0.2s",
            }}>
              {m === "log" ? "📋 Log Activity" : "📢 Share to Feed"}
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
                background: mainMode === m ? `linear-gradient(135deg,${C.blue},#A78BFA)` : "#1A1228",
                color: mainMode === m ? "#fff" : C.sub,
                transition: "all 0.15s",
              }}>
                {m === "log" ? "📋 Log Activity" : "📢 Share to Feed"}
              </button>
            ))}
          </div>

          {/* Log sub-tabs · only when in log mode */}
          {mainMode === "log" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Activity Type</div>
              {TAB_DEFS.map(t => (
                <button key={t.key} onClick={() => setLogTab(t.key)} style={{
                  width: "100%", padding: "16px 18px", borderRadius: 16, border: "none", cursor: "pointer",
                  marginBottom: 8, textAlign: "left", fontWeight: 800, fontSize: 16,
                  background: logTab === t.key ? t.color : "#1A1228",
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
              ? "🌐 Public by default · visible on your profile. Toggle private per-entry."
              : "📢 Posted to your followers' feed."}
          </div>
        </div>

        {/* -- Main content -- */}
        <div className="post-main" style={{ padding: "24px 20px" }}>
        {mainMode === "log" ? (<>

          {/* --- WORKOUT TAB --- */}
          {logTab === "workout" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* -- Fitbit Connect -- */}
              <FitbitConnect />

              {/* -- Resume banner removed -- users can now log multiple
                  workouts per day. Each save inserts a new row. To edit a
                  previously logged workout, edit it from the activity feed
                  (TODO: add edit affordance there). */}

              {/* AI Plan import banner — shown after user picks a day from
                  their saved plan. Reminds them what plan they're logging
                  against. Tappable × dismisses without clearing exercises. */}
              {loadedPlanLabel && (
                <div style={{
                  background: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(74,222,128,0.10))",
                  borderRadius: 14, padding: "10px 14px",
                  border: "1.5px solid rgba(124,58,237,0.4)",
                  marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{ fontSize: 18 }}>📋</div>
                  <div style={{ flex: 1, fontSize: 12, color: "#A78BFA", fontWeight: 700 }}>
                    From your AI Plan: <span style={{ color: "#F0F0F0" }}>{loadedPlanLabel}</span>
                  </div>
                  <button onClick={() => setLoadedPlanLabel(null)}
                    style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              )}

              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>💪 Workout Details</div>
                  {/* "Use AI Plan" button — only shown if a plan was generated.
                      Opens a picker so the user can choose which training day
                      to import as a starting point. */}
                  {aiPlan && (
                    <button onClick={() => setShowPlanPicker(true)}
                      style={{
                        fontSize: 12, fontWeight: 800,
                        padding: "7px 14px", borderRadius: 99,
                        background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
                        border: "none", color: "#fff",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                      📋 Use AI Plan
                    </button>
                  )}
                </div>

                {/* Name — optional user label like "Push Day A" or "Morning 5K" */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Workout Name <span style={{ color: C.sub, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <input style={iStyle} placeholder={`e.g. ${includeLifting ? 'Push Day A' : includeCardio ? 'Morning 5K' : 'Give it a name'}`} value={woType} onChange={e => setWoType(e.target.value)} />
                </div>

                {/* Date — optional. Defaults to today. Bounded to the last 3
                    calendar days so users can backfill recent missed workouts
                    without being able to retroactively edit ancient history. */}
                {(() => {
                  const today = new Date();
                  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  const todayStr = ymd(today);
                  const min = new Date(today); min.setDate(today.getDate() - 3);
                  const minStr = ymd(min);
                  // Friendly chip — what does the chosen date look like in plain English?
                  let chip = "";
                  if (woDate) {
                    const [y, mo, d] = woDate.split('-').map(Number);
                    const picked = new Date(y, mo - 1, d);
                    const yest = new Date(today); yest.setDate(today.getDate() - 1);
                    if (woDate === todayStr) chip = "Today";
                    else if (woDate === ymd(yest)) chip = "Yesterday";
                    else {
                      const days = Math.round((today.getTime() - picked.getTime()) / 86400000);
                      chip = `${days} days ago · ${picked.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
                    }
                  }
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                        Date <span style={{ color: C.sub, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional · log a late workout up to 3 days back)</span>
                      </label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          type="date"
                          min={minStr}
                          max={todayStr}
                          style={{ ...iStyle, flex: 1, minWidth: 160 }}
                          value={woDate}
                          onChange={e => setWoDate(e.target.value)}
                        />
                        {chip && (
                          <span style={{ padding: "6px 12px", borderRadius: 999, background: woDate === todayStr ? `${C.green}33` : "#7C3AED33", color: woDate === todayStr ? C.green : "#A78BFA", fontWeight: 800, fontSize: 12 }}>
                            {chip}
                          </span>
                        )}
                        {woDate && (
                          <button
                            onClick={() => setWoDate("")}
                            style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.greenMid}`, background: "transparent", color: C.sub, fontWeight: 800, fontSize: 12, cursor: "pointer" }}
                            type="button"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Workout time — optional. If set, uses today's date at this
                    time. Defaults to "now" when blank. Lets users log after
                    the fact and still show the correct time on their card. */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Time <span style={{ color: C.sub, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional · defaults to now)</span>
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="time"
                      style={{ ...iStyle, flex: 1 }}
                      value={woTime}
                      onChange={e => setWoTime(e.target.value)}
                    />
                    {woTime && (
                      <button
                        onClick={() => setWoTime("")}
                        style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.greenMid}`, background: "transparent", color: C.sub, fontWeight: 800, fontSize: 12, cursor: "pointer" }}
                        type="button"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* What did you do? — toggle Cardio + Lifting independently
                    or fall back to "Other type" for hiit/yoga/pilates/etc. */}
                <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  What did you do?
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  <button
                    onClick={() => {
                      setIncludeCardio(c => !c);
                      // If turning ON cardio while in single-mode (hiit/yoga), reset to combined-mode
                      if (!["running","walking","biking","swimming","rowing","lifting"].includes(woCategory)) {
                        setWoCategory("lifting");
                      }
                    }}
                    style={{
                      flex: "1 1 130px", padding: "11px 14px", borderRadius: 12,
                      background: includeCardio ? "rgba(124,58,237,0.18)" : C.white,
                      border: `2px solid ${includeCardio ? C.blue : C.greenMid}`,
                      color: includeCardio ? "#A78BFA" : C.sub,
                      fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left",
                    }}>
                    {includeCardio ? "✓" : "+"} 🏃 Cardio
                  </button>
                  <button
                    onClick={() => {
                      setIncludeLifting(l => !l);
                      if (!["running","walking","biking","swimming","rowing","lifting"].includes(woCategory)) {
                        setWoCategory("lifting");
                      }
                    }}
                    style={{
                      flex: "1 1 130px", padding: "11px 14px", borderRadius: 12,
                      background: includeLifting ? "rgba(124,58,237,0.18)" : C.white,
                      border: `2px solid ${includeLifting ? C.blue : C.greenMid}`,
                      color: includeLifting ? "#A78BFA" : C.sub,
                      fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left",
                    }}>
                    {includeLifting ? "✓" : "+"} 🏋️ Lifting
                  </button>
                </div>

                {/* "Or pick a different workout type" — for hiit/yoga/pilates/boxing/sports/other.
                    Picking one of these turns OFF the cardio toggle (because cardio's
                    cardio-specific dropdown is for running/walking/biking/swimming/rowing).
                    Lifting stays on its own track — you CAN do "sports + lifting" or
                    "HIIT + lifting" in one log. The cardio toggle only conflicts with
                    these because both occupy the "primary cardio activity" slot. */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Or a different type
                  </label>
                  <select style={iStyle}
                    value={["running","walking","biking","swimming","rowing","lifting"].includes(woCategory) ? "" : woCategory}
                    onChange={e => {
                      if (!e.target.value) return;
                      setWoCategory(e.target.value);
                      // Turn off cardio block since this is a different
                      // (non-running/walking/etc.) primary activity.
                      // KEEP lifting toggle as-is so users can combine
                      // e.g. "Sports + Lifting" or "HIIT + Lifting".
                      setIncludeCardio(false);
                    }}>
                    <option value="">— Pick one (HIIT, Yoga, etc.) —</option>
                    {WORKOUT_CATEGORIES.filter(c => !["running","walking","biking","swimming","rowing","lifting"].includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.emoji}  {c.label}</option>
                    ))}
                  </select>
                </div>

                {/* ── CARDIO BLOCK — only when toggle on ─────────────────── */}
                {includeCardio && (() => {
                  const distNum = parseFloat(cardioBlockDistance) || 0;
                  const durNum  = parseFloat(cardioBlockDuration)  || 0;
                  let paceText = "";
                  if (distNum > 0 && durNum > 0) {
                    if (cardioSubcategory === "running") {
                      const p = durNum / distNum;
                      const m = Math.floor(p);
                      const s = Math.round((p - m) * 60);
                      paceText = `${m}:${s.toString().padStart(2, "0")} min/mi`;
                    } else if (cardioSubcategory === "biking") {
                      paceText = `${((distNum / durNum) * 60).toFixed(1)} mph`;
                    } else if (cardioSubcategory === "swimming") {
                      const p = (durNum / distNum) * 100;
                      const m = Math.floor(p);
                      const s = Math.round((p - m) * 60);
                      paceText = `${m}:${s.toString().padStart(2, "0")} min/100yd`;
                    }
                  }
                  const showPace = ["running","biking","swimming"].includes(cardioSubcategory);
                  const distUnit = cardioSubcategory === "swimming" ? "yards" : cardioSubcategory === "rowing" ? "meters" : "miles";
                  return (
                    <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: "rgba(124,58,237,0.08)", border: `1.5px solid ${C.blue}` }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#A78BFA", marginBottom: 10 }}>🏃 Cardio</div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Type</label>
                        <select style={iStyle} value={cardioSubcategory} onChange={e => setCardioSubcategory(e.target.value)}>
                          <option value="running">🏃 Running</option>
                          <option value="walking">🚶 Walking</option>
                          <option value="biking">🚴 Biking</option>
                          <option value="swimming">🏊 Swimming</option>
                          <option value="rowing">🚣 Rowing</option>
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Duration (min)</label>
                          <input style={iStyle} type="text" inputMode="numeric" placeholder="e.g. 30" value={cardioBlockDuration} onChange={e => setCardioBlockDuration(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Distance ({distUnit})</label>
                          <input style={iStyle} type="text" inputMode="decimal" placeholder={cardioSubcategory === "swimming" ? "1000" : cardioSubcategory === "rowing" ? "2000" : "3.2"} value={cardioBlockDistance} onChange={e => setCardioBlockDistance(e.target.value)} />
                        </div>
                      </div>
                      {showPace && (
                        <div style={{ marginTop: 10, background: "#0D0D0D", borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.greenMid}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
                            Pace · auto-calculated
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: paceText ? C.gold : C.sub }}>
                            {paceText || "Enter distance + duration"}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── LIFTING DURATION (only when lifting toggled on) ── */}
                {includeLifting && (
                  <div style={{ marginBottom: 4, padding: 14, borderRadius: 14, background: "rgba(124,58,237,0.08)", border: `1.5px solid ${C.blue}` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#A78BFA", marginBottom: 10 }}>🏋️ Lifting</div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Duration (min) <span style={{ color: C.sub, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                    <input style={iStyle} type="text" inputMode="numeric" placeholder="e.g. 45" value={woDuration} onChange={e => setWoDuration(e.target.value)} />
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>Add your exercises in the section below ↓</div>
                  </div>
                )}

                {/* ── "OTHER TYPE" DURATION BLOCK ──
                    Shown whenever the user picked HIIT/yoga/pilates/boxing/sports/other
                    from the dropdown above. Renders alongside the lifting block
                    when both are wanted (e.g. "Sports + Lifting" combo log). */}
                {!["running","walking","biking","swimming","rowing","lifting"].includes(woCategory) && (() => {
                  const cat = WORKOUT_CATEGORIES.find(c => c.id === woCategory);
                  if (!cat) return null;
                  return (
                    <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: "rgba(124,58,237,0.08)", border: `1.5px solid ${C.blue}` }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#A78BFA", marginBottom: 10 }}>{cat.emoji} {cat.label}</div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Duration (min)</label>
                      <input style={iStyle} type="text" inputMode="numeric" placeholder="e.g. 45" value={otherTypeDuration} onChange={e => setOtherTypeDuration(e.target.value)} />
                    </div>
                  );
                })()}
              </div>

              {/* Workout Templates */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>📋 Templates</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {/* Load template dropdown */}
                  <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
                    <button
                      onClick={() => { fetchTemplates(); setTemplateDropdownOpen(o => !o); }}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${C.blue}`, background: C.greenLight, color: C.blue, fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <span>📋 Load Template</span>
                      <span style={{ fontSize: 10 }}>{templateDropdownOpen ? "?" : "?"}</span>
                    </button>
                    {templateDropdownOpen && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999, background: "#1A1228", border: "1.5px solid #7C3AED", borderRadius: 12, boxShadow: "0 8px 32px rgba(124,58,237,0.25)", overflow: "hidden", marginTop: 4 }}>
                        {templates.length === 0 ? (
                          <div style={{ padding: "14px 16px", fontSize: 13, color: C.sub, textAlign: "center" }}>No templates yet.<br/>Save your first workout below!</div>
                        ) : templates.map((tpl, i) => (
                          <div key={tpl.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < templates.length - 1 ? "1px solid #2D1B69" : "none" }}>
                            <button
                              onMouseDown={() => loadTemplate(tpl)}
                              style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              <div style={{ fontWeight: 700, fontSize: 13, color: "#F0F0F0" }}>{tpl.name}</div>
                              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                                {tpl.exercises.length} exercise{tpl.exercises.length !== 1 ? "s" : ""}
                              </div>
                            </button>
                            <button
                              onMouseDown={() => deleteTemplate(tpl.id)}
                              style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#FFE8E8", color: "#FF4444", fontSize: 12, cursor: "pointer", flexShrink: 0, marginLeft: 8 }}
                            >·</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Save as template button */}
                  <button
                    onClick={() => setShowSaveTemplate(s => !s)}
                    style={{ padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${C.greenMid}`, background: C.greenLight, color: C.sub, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
                  >💾 Save as Template</button>
                </div>
                {/* Template name input (shown when saving) */}
                {showSaveTemplate && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      style={{ ...iStyle, flex: 1 }}
                      placeholder="Template name (e.g. Push Day A)"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveTemplate()}
                    />
                    <button
                      onClick={saveTemplate}
                      disabled={templateSaving || !templateName.trim() || exercises.length === 0}
                      style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: templateSaving ? C.greenMid : C.blue, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", flexShrink: 0 }}
                    >{templateSaving ? "..." : "Save"}</button>
                  </div>
                )}
              </div>

              {/* Exercises table · with search autocomplete, increment buttons, prev session */}
              {/* Only shown when lifting is toggled on (combined-mode workouts) */}
              {includeLifting && (
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Exercises</div>
                  <button onClick={() => setExercises(ex => [...ex, { name: "", sets: "3", reps: "10", weight: "", weights: ["", "", ""] }])}
                    style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.blue}`, background: C.greenLight, color: C.blue, cursor: "pointer" }}>
                    + Add Exercise
                  </button>
                </div>
                {exercises.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.sub, fontSize: 13 }}>No exercises yet · click + Add Exercise</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {exercises.map((ex, i) => {
                    const numSets = parseInt(ex.sets) || 1;
                    const prev = prevSessions[ex.name];
                    return (
                    <div key={i} style={{ background: "#0D0D0D", borderRadius: 16, padding: 14, border: `1px solid ${C.greenMid}` }}>
                      {/* Exercise name · search input */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <ExerciseSearchInput
                          value={ex.name}
                          style={iStyle}
                          onChange={name => {
                            setExercises(exs => exs.map((x, j) => j === i ? { ...x, name } : x));
                            if (name.length >= 2) fetchPrevSession(name);
                          }}
                        />
                        <button onClick={() => setExercises(exs => exs.filter((_, j) => j !== i))}
                          style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#FFE8E8", color: "#FF4444", fontSize: 16, cursor: "pointer", flexShrink: 0 }}>·</button>
                      </div>

                      {/* Previous session reference */}
                      {prev && (
                        <div style={{ background: "#1A1228", borderRadius: 10, padding: "7px 12px", marginBottom: 10, fontSize: 12, color: "#A78BFA" }}>
                          <span style={{ fontWeight: 700 }}>Last time ({prev.date}): </span>
                          {prev.sets.map((s, si) => `${s.weight}lbs\u00d7${s.reps}`).join(' \u00b7 ')}
                        </div>
                      )}

                      {/* Sets / Reps row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 800, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Sets</label>
                          <input style={iStyle} type="text" inputMode="numeric" value={ex.sets} onChange={e => {
                            const newSets = e.target.value;
                            const n = parseInt(newSets) || 1;
                            setExercises(exs => exs.map((x, j) => {
                              if (j !== i) return x;
                              const existingWeights = x.weights || [];
                              // Find the last filled weight to use as default for new sets
                              const lastFilledW = [...existingWeights].reverse().find(w => w !== '') || x.weight || '';
                              const newWeights = Array(n).fill('').map((_, k) => existingWeights[k] ?? lastFilledW);
                              return { ...x, sets: newSets, weights: newWeights };
                            }));
                          }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 800, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Reps</label>
                          <input style={iStyle} type="text" inputMode="numeric" value={ex.reps} onChange={e => setExercises(exs => exs.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} />
                        </div>
                      </div>

                      {/* Per-set weight with increment buttons */}
                      <label style={{ fontSize: 10, fontWeight: 800, color: C.sub, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Weight (lbs)</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {Array.from({ length: numSets }).map((_, s) => {
                          function updateW(delta: number) {
                            setExercises(exs => exs.map((x, j) => {
                              if (j !== i) return x;
                              const ws = [...(x.weights || Array(numSets).fill(''))];
                              // If this set is empty, start from the previous set's weight
                              const base = parseFloat(ws[s] !== '' ? ws[s] : (s > 0 ? ws[s - 1] : '0') || '0') || 0;
                              ws[s] = String(Math.max(0, base + delta));
                              return { ...x, weights: ws, weight: ws[0] };
                            }));
                          }
                          return (
                            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, width: 28, flexShrink: 0 }}>S{s+1}</span>
                              <input
                                style={{ ...iStyle, flex: 1, padding: "7px 10px", fontSize: 13 }}
                                type="text" inputMode="decimal" placeholder="0"
                                value={(ex.weights || [])[s] ?? ''}
                                onChange={e => setExercises(exs => exs.map((x, j) => {
                                  if (j !== i) return x;
                                  const ws = [...(x.weights || Array(numSets).fill(''))];
                                  ws[s] = e.target.value;
                                  return { ...x, weights: ws, weight: ws[0] };
                                }))}
                              />
                              {[2.5, 5, 10].map(d => (
                                <button key={d} onClick={() => updateW(d)}
                                  style={{ fontSize: 11, fontWeight: 800, padding: "5px 8px", borderRadius: 8, border: `1.5px solid ${C.greenMid}`, background: C.greenLight, color: C.blue, cursor: "pointer", flexShrink: 0 }}>
                                  +{d}
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      {/* Notes per exercise */}
                      <div style={{ marginTop: 10 }}>
                        <input
                          style={{ ...iStyle, fontSize: 12 }}
                          placeholder="Notes (optional)"
                          value={ex.notes || ''}
                          onChange={e => setExercises(exs => exs.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))}
                        />
                      </div>
                    </div>
                    );
                  })}
                  </div>
                )}
              </div>
              )}

              {/* Notes & Photo */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>Notes & Photo</div>
                <textarea rows={3} style={{ ...iStyle, resize: "none", marginBottom: 14 }} placeholder="How did it feel? Any PRs?" value={woNotes} onChange={e => setWoNotes(e.target.value)} />
                <label style={{ display: "block", cursor: "pointer" }}>
                  {woPhoto ? (
                    <img src={woPhoto} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 14, display: "block" }} alt="" />
                  ) : (
                    <div style={{ border: `2px dashed ${C.greenMid}`, borderRadius: 14, padding: "20px 0", textAlign: "center", background: C.greenLight }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>💪</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>Add photo · won't appear on feed</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Saved privately to your profile</div>
                    </div>
                  )}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => loadPhoto(e, setWoPhoto)} />
                </label>
              </div>

              <SaveErrorBanner />
              <PrivacyToggle />
              <button onClick={handleSave} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading ? C.greenMid : `linear-gradient(135deg,${C.blue},#A78BFA)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving..." : "💾 Save to Log"}
              </button>
            </div>
          )}

          {/* --- NUTRITION TAB --- */}
          {logTab === "nutrition" && (() => {
            // Load goals on tab open
            if (!goalsLoaded && user) fetchMacroGoalsAndTotals();

            // Auto-calculated totals from food items
            const autoCalories = foodItems.reduce((s, f) => s + (parseFloat(f.calories) || 0), 0);
            const autoProtein = foodItems.reduce((s, f) => s + (parseFloat(f.protein || '0') || 0), 0);
            const autoCarbs = foodItems.reduce((s, f) => s + (parseFloat(f.carbs || '0') || 0), 0);
            const autoFat = foodItems.reduce((s, f) => s + (parseFloat(f.fat || '0') || 0), 0);
            // Use auto-calculated if items exist, else fall back to manual fields
            const displayProtein = autoProtein > 0 ? String(Math.round(autoProtein)) : protein;
            const displayCarbs = autoCarbs > 0 ? String(Math.round(autoCarbs)) : carbs;
            const displayFat = autoFat > 0 ? String(Math.round(autoFat)) : fat;
            const displayCalories = autoCalories > 0 ? autoCalories : parseFloat(foodItems.reduce((s, f) => String(parseFloat(s) + (parseFloat(f.calories) || 0)), '0') || '0');

            function MacroBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
              const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
              const barColor = pct > 110 ? '#EF4444' : pct >= 80 ? '#A78BFA' : '#F59E0B';
              return (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#F0F0F0' }}>{label}</span>
                    <span style={{ fontSize: 12, color: barColor, fontWeight: 700 }}>{current}g / {goal}g</span>
                  </div>
                  <div style={{ background: '#2D1B69', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 6, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            }

            return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Daily Progress (shown when goals exist) */}
              {macroGoals && (
                <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>📊 Today's Progress</div>
                    <button onClick={() => setShowGoalsEditor(s => !s)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${C.greenMid}`, background: 'transparent', color: C.sub, cursor: 'pointer', fontWeight: 700 }}>
                      {showGoalsEditor ? '✕ Cancel' : '⚙️ Edit Goals'}
                    </button>
                  </div>
                  {showGoalsEditor ? (
                    <div>
                      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>🎯 Daily Macro Goals:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                        {([
                          { l: 'Calories', k: 'calories' as keyof NutritionGoals, unit: 'kcal' },
                          { l: 'Protein', k: 'protein' as keyof NutritionGoals, unit: 'g' },
                          { l: 'Carbs', k: 'carbs' as keyof NutritionGoals, unit: 'g' },
                          { l: 'Fat', k: 'fat' as keyof NutritionGoals, unit: 'g' },
                          { l: 'Water', k: 'water_oz' as keyof NutritionGoals, unit: 'oz' },
                        ] as { l: string; k: keyof NutritionGoals; unit: string }[]).map(f => (
                          <div key={f.k}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>{f.l} ({f.unit})</label>
                            <input
                              style={iStyle}
                              type="text" inputMode="numeric"
                              value={String(editGoals[f.k])}
                              onChange={e => setEditGoals(g => ({ ...g, [f.k]: parseFloat(e.target.value) || 0 }))}
                            />
                          </div>
                        ))}
                      </div>

                      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12, paddingTop: 12, borderTop: `1px solid ${C.greenMid}` }}>📅 Monthly Macro Goals (optional):</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                        {([
                          { l: 'Total Calories', k: 'monthly_calories' as keyof NutritionGoals, unit: 'kcal' },
                          { l: 'Total Protein', k: 'monthly_protein' as keyof NutritionGoals, unit: 'g' },
                          { l: 'Total Carbs', k: 'monthly_carbs' as keyof NutritionGoals, unit: 'g' },
                          { l: 'Total Fat', k: 'monthly_fat' as keyof NutritionGoals, unit: 'g' },
                        ] as { l: string; k: keyof NutritionGoals; unit: string }[]).map(f => (
                          <div key={f.k}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>{f.l} ({f.unit})</label>
                            <input
                              style={iStyle}
                              type="text" inputMode="numeric"
                              value={String(editGoals[f.k] || '')}
                              onChange={e => setEditGoals(g => ({ ...g, [f.k]: parseFloat(e.target.value) || 0 }))}
                              placeholder="optional"
                            />
                          </div>
                        ))}
                      </div>

                      <button onClick={saveMacroGoals} style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,#7C3AED,#A78BFA)`, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                        Save Goals
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* Calories progress */}
                      {(() => {
                        const todayCal = (dailyTotals?.calories || 0) + autoCalories;
                        const goalCal = macroGoals.calories;
                        const pct = goalCal > 0 ? Math.min(100, Math.round((todayCal / goalCal) * 100)) : 0;
                        const barColor = todayCal > goalCal * 1.1 ? '#EF4444' : todayCal >= goalCal * 0.8 ? '#A78BFA' : '#F59E0B';
                        return (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#F0F0F0' }}>🔥 Calories</span>
                              <span style={{ fontSize: 13, color: barColor, fontWeight: 800 }}>{Math.round(todayCal)} / {goalCal} kcal</span>
                            </div>
                            <div style={{ background: '#2D1B69', borderRadius: 8, height: 12, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`, borderRadius: 8, transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        );
                      })()}
                      <MacroBar label="🥩 Protein" current={Math.round((dailyTotals?.protein || 0) + autoProtein)} goal={macroGoals.protein} color="#7C3AED" />
                      <MacroBar label="🍞 Carbs" current={Math.round((dailyTotals?.carbs || 0) + autoCarbs)} goal={macroGoals.carbs} color="#F59E0B" />
                      <MacroBar label="🥑 Fat" current={Math.round((dailyTotals?.fat || 0) + autoFat)} goal={macroGoals.fat} color="#A78BFA" />
                      {/* Water progress */}
                      {(() => {
                        const todayWater = (dailyTotals?.water_oz || 0) + (parseFloat(water) || 0);
                        const goalWater = macroGoals.water_oz;
                        const pct = goalWater > 0 ? Math.min(100, Math.round((todayWater / goalWater) * 100)) : 0;
                        return (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#F0F0F0' }}>💧 Water</span>
                              <span style={{ fontSize: 12, color: '#38BDF8', fontWeight: 700 }}>{Math.round(todayWater)}oz / {goalWater}oz</span>
                            </div>
                            <div style={{ background: '#2D1B69', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: '#38BDF8', borderRadius: 6 }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Set goals CTA (if no goals set) */}
              {!macroGoals && (
                <button
                  onClick={() => { setShowGoalsEditor(true); setMacroGoals({ calories: 2500, protein: 180, carbs: 250, fat: 70, water_oz: 100 }); }}
                  style={{ background: C.white, borderRadius: 22, padding: '14px 20px', border: `2px dashed ${C.blue}`, color: C.blue, fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' as const, display: 'block', width: '100%' }}
                >
                  💡 Set daily macro goals · see progress bars
                </button>
              )}

              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>🥗 Meal Details</div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Meal Type</label>
                <select style={iStyle} value={mealType} onChange={e => setMealType(e.target.value)}>
                  {MEAL_TYPES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              {/* Food search + items */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Food Items</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setShowAIScanner(true)}
                      style={{ fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 20, border: "none", background: "linear-gradient(135deg, #7C3AED, #A78BFA)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      🤖 Scan with AI
                    </button>
                    <button onClick={() => setFoodItems(f => [...f, { name: "", calories: "" }])}
                      style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.blue}`, background: C.greenLight, color: C.blue, cursor: "pointer" }}>
                      + Manual
                    </button>
                  </div>
                </div>



                {/* Food search */}
                <FoodSearchInput
                  onSelect={(food) => {
                    setFoodItems(f => [...f, {
                      name: food.name,
                      calories: String(food.calories),
                      protein: String(food.protein),
                      carbs: String(food.carbs),
                      fat: String(food.fat),
                      servingSize: food.servingSize,
                      qty: '1',
                    }]);
                  }}
                />
                {foodItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "12px 0", color: C.sub, fontSize: 13 }}>
                    Search for foods above or add manually
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {foodItems.map((item, i) => (
                      <div key={i} style={{ background: '#0D0D0D', borderRadius: 14, padding: '10px 12px', border: '1px solid #2D1B69' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: item.protein ? 6 : 0 }}>
                          <input
                            style={{ ...iStyle, flex: 1, fontSize: 13, padding: '7px 10px' }}
                            placeholder="Food name"
                            value={item.name}
                            onChange={e => setFoodItems(f => f.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          />
                          <input
                            style={{ ...iStyle, width: 70, flexShrink: 0, fontSize: 13, padding: '7px 8px', textAlign: 'center' as const }}
                            type="text" inputMode="numeric" placeholder="kcal"
                            value={item.calories}
                            onChange={e => setFoodItems(f => f.map((x, j) => j === i ? { ...x, calories: e.target.value } : x))}
                          />
                          <button onClick={() => setFoodItems(f => f.filter((_, j) => j !== i))}
                            style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "#FFE8E8", color: "#FF4444", fontSize: 16, cursor: "pointer", flexShrink: 0 }}>·</button>
                        </div>
                        {/* Macro detail row */}
                        {(item.protein || item.carbs || item.fat) && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#9CA3AF' }}>Per serving</span>
                            {['protein', 'carbs', 'fat'].map(k => (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <input
                                  style={{ ...iStyle, width: 52, padding: '4px 6px', fontSize: 11, textAlign: 'center' as const }}
                                  type="text" inputMode="decimal" placeholder="0"
                                  value={(item as any)[k] || ''}
                                  onChange={e => setFoodItems(f => f.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))}
                                />
                                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{k[0].toUpperCase()}</span>
                              </div>
                            ))}
                            {item.servingSize && <span style={{ fontSize: 10, color: '#6B7280' }}>{item.servingSize}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Auto-calculated totals */}
                    {autoCalories > 0 && (
                      <div style={{ background: '#1A1228', borderRadius: 12, padding: '10px 14px', border: '1px solid #7C3AED', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#A78BFA' }}>This meal:</span>
                        <div style={{ display: 'flex', gap: 14 }}>
                          <span style={{ fontSize: 12, color: '#F5A623', fontWeight: 700 }}>{Math.round(autoCalories)} cal</span>
                          {autoProtein > 0 && <span style={{ fontSize: 12, color: '#F0F0F0' }}>{Math.round(autoProtein)}g P</span>}
                          {autoCarbs > 0 && <span style={{ fontSize: 12, color: '#F0F0F0' }}>{Math.round(autoCarbs)}g C</span>}
                          {autoFat > 0 && <span style={{ fontSize: 12, color: '#F0F0F0' }}>{Math.round(autoFat)}g F</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Macros (manual override / supplement) */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 6 }}>Total Macros</div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
                  {autoCalories > 0 ? '? Auto-calculated from food items above · override below if needed' : 'Fill in manually or use food search above'}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {[{ l: "Protein (g)", v: displayProtein, s: setProtein }, { l: "Carbs (g)", v: displayCarbs, s: setCarbs }, { l: "Fat (g)", v: displayFat, s: setFat }].map(f => (
                    <div key={f.l}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.l}</label>
                      <input style={iStyle} type="text" inputMode="numeric" placeholder="0" value={f.v} onChange={e => f.s(e.target.value)} />
                    </div>
                  ))}
                </div>

                {/* Water tracking */}
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>💧 Water Intake</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <input style={{ ...iStyle, maxWidth: 100 }} placeholder="oz" value={water} onChange={e => setWater(e.target.value)} />
                  {[8, 16, 32].map(oz => (
                    <button key={oz}
                      onClick={() => setWater(w => String((parseFloat(w) || 0) + oz))}
                      style={{ padding: '7px 12px', borderRadius: 20, border: `1.5px solid ${C.greenMid}`, background: C.greenLight, color: '#38BDF8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      +{oz}oz
                    </button>
                  ))}
                  {water && <span style={{ fontSize: 12, color: '#38BDF8', fontWeight: 700 }}>{water} oz total</span>}
                </div>
              </div>

              {/* Per-Meal Photos */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>📸 Meal Photos</div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>Add a photo for the selected meal type ({mealType})</div>
                <label style={{ display: "block", cursor: "pointer" }}>
                  {mealPhotos[mealType] ? (
                    <div style={{ position: "relative" }}>
                      <img src={mealPhotos[mealType]} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 14, display: "block" }} alt="" />
                      <button
                        onClick={e => { e.preventDefault(); setMealPhotos(p => { const n = {...p}; delete n[mealType]; return n; }); }}
                        style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", fontSize: 14, cursor: "pointer" }}>·</button>
                    </div>
                  ) : (
                    <div style={{ border: `2px dashed ${C.greenMid}`, borderRadius: 14, padding: "16px 0", textAlign: "center", background: C.greenLight }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>📸</div>
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
                        <button onClick={e => { e.preventDefault(); setMealPhotos(p => { const n = {...p}; delete n[meal]; return n; }); }} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", fontSize: 11, cursor: "pointer", padding: 0 }}>·</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>Notes</div>
                <textarea rows={3} style={{ ...iStyle, resize: "none" }} placeholder="Meal notes..." value={nutNotes} onChange={e => setNutNotes(e.target.value)} />
              </div>

              <SaveErrorBanner />
              <PrivacyToggle />
              <button onClick={() => {
                // Sync auto-calculated macros to state before saving
                if (autoProtein > 0) setProtein(String(Math.round(autoProtein)));
                if (autoCarbs > 0) setCarbs(String(Math.round(autoCarbs)));
                if (autoFat > 0) setFat(String(Math.round(autoFat)));
                handleSave();
              }} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading ? C.greenMid : `linear-gradient(135deg,${C.blue},#A78BFA)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving..." : "💾 Save to Log"}
              </button>
            </div>
            );
          })()}

          {/* --- WELLNESS TAB --- */}
          {logTab === "wellness" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 6 }}>🧘 Wellness Activities</div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 14, lineHeight: 1.4 }}>
                  Stack as many as you want. Sauna + cold plunge + meditation? Add all three.
                </div>

                {/* List of activity rows. Each one is its own card with
                    a type dropdown, duration input, and remove button. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                  {wellnessActivities.map((act, idx) => {
                    const isFasting = act.type === 'Fasting';
                    return (
                      <div key={act.id} style={{ background: '#0D0D0D', borderRadius: 14, padding: 12, border: '1px solid #2D1B69', position: 'relative' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isFasting ? '1fr auto' : '1.4fr 1fr auto', gap: 8, alignItems: 'end' }}>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Activity</label>
                            <select
                              style={iStyle}
                              value={act.type}
                              onChange={e => {
                                const newType = e.target.value;
                                setWellnessActivities(prev => prev.map((a, i) => i === idx ? { ...a, type: newType } : a));
                              }}>
                              {WELLNESS_GROUPS.map(group => (
                                <optgroup key={group.label} label={group.label}>
                                  {group.types.map(t => {
                                    // Sleep / Fasting can each only appear once per save —
                                    // hide them in OTHER rows' dropdowns if already chosen.
                                    const alreadyUsedElsewhere = (t === 'Sleep' || t === 'Fasting')
                                      && wellnessActivities.some((a, i) => i !== idx && a.type === t);
                                    if (alreadyUsedElsewhere) return null;
                                    return <option key={t} value={t}>{t}</option>;
                                  })}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                          {!isFasting && (
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Duration (min)</label>
                              <input
                                style={iStyle}
                                type="text"
                                inputMode="numeric"
                                placeholder="e.g. 20"
                                value={act.duration}
                                onChange={e => {
                                  const v = e.target.value;
                                  setWellnessActivities(prev => prev.map((a, i) => i === idx ? { ...a, duration: v } : a));
                                }}
                              />
                            </div>
                          )}
                          {wellnessActivities.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setWellnessActivities(prev => prev.filter((_, i) => i !== idx))}
                              aria-label="Remove activity"
                              style={{
                                width: 38, height: 38, borderRadius: 10,
                                border: `1.5px solid ${C.greenMid}`, background: 'transparent',
                                color: '#EF4444', fontSize: 18, fontWeight: 800, cursor: 'pointer',
                              }}>
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add another activity button. Disabled when 10+ entries
                    to keep things manageable — a typical day shouldn't
                    realistically have more than that. */}
                {wellnessActivities.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setWellnessActivities(prev => [...prev, { id: `w-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, type: 'Meditation', duration: '' }])}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12,
                      border: `2px dashed ${C.greenMid}`, background: 'transparent',
                      color: C.blue, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      marginBottom: 12,
                    }}>
                    + Add another activity
                  </button>
                )}

                {/* Fasting-specific block — minimum 12 hours enforced on save.
                    Only shown when Fasting is in the activities list. */}
                {hasFasting && (
                  <div style={{ marginBottom: 12, padding: 14, borderRadius: 14, background: "rgba(124,58,237,0.08)", border: `1.5px solid ${C.blue}` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#A78BFA", marginBottom: 10 }}>⏳ Fasting Details</div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Hours fasted</label>
                    <input
                      style={iStyle}
                      type="text" inputMode="numeric"
                      placeholder="e.g. 16"
                      value={fastingHours}
                      onChange={e => setFastingHours(e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 8, lineHeight: 1.4 }}>
                      Minimum <strong style={{ color: C.text }}>12 hours</strong> to count as a fast — anything shorter is just regular eating habits.
                      Beyond that, hours don't change badge progress — every 12+ hour fast counts as one toward the ladder.
                    </div>
                  </div>
                )}

                {/* Sleep-specific fields. Only shown when Sleep is in the list. */}
                {hasSleep && (
                  <div style={{ background: '#0D0D0D', borderRadius: 14, padding: 14, border: '1px solid #2D1B69', marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#A78BFA', marginBottom: 12 }}>😴 Sleep Details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>Hours Slept</label>
                        <input style={iStyle} type="text" inputMode="decimal" placeholder="e.g. 7.5" value={sleepHours} onChange={e => setSleepHours(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>Sleep Quality (1-5)</label>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          {[1, 2, 3, 4, 5].map(q => (
                            <button key={q} onClick={() => setSleepQuality(sleepQuality === q ? null : q)} style={{
                              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: sleepQuality === q ? '#7C3AED' : '#1A1228',
                              color: sleepQuality === q ? '#fff' : '#9CA3AF',
                              fontWeight: 800, fontSize: 13, transition: 'all 0.15s',
                            }}>{q}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>Bedtime</label>
                        <input style={iStyle} type="time" value={sleepBedtime} onChange={e => setSleepBedtime(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>Wake Time</label>
                        <input style={iStyle} type="time" value={sleepWakeTime} onChange={e => setSleepWakeTime(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Steps, HRV, Resting HR — shared across all activities for the day */}
                <div style={{ background: '#0D0D0D', borderRadius: 14, padding: 14, border: '1px solid #2D1B69', marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#A78BFA', marginBottom: 12 }}>📊 Body Stats (optional)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>Steps</label>
                      <input style={iStyle} type="text" inputMode="numeric" placeholder="e.g. 8500" value={steps} onChange={e => setSteps(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>HRV (ms)</label>
                      <input style={iStyle} type="text" inputMode="numeric" placeholder="e.g. 62" value={hrv} onChange={e => setHrv(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>Resting HR</label>
                      <input style={iStyle} type="text" inputMode="numeric" placeholder="e.g. 58" value={restingHR} onChange={e => setRestingHR(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280' }}>Wearable sync (Apple Health, WHOOP) coming in v2</div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Notes</label>
                  <textarea rows={3} style={{ ...iStyle, resize: "none" }} placeholder="How was it? How do you feel?" value={wellnessNotes} onChange={e => setWellnessNotes(e.target.value)} />
                </div>
              </div>

              {/* Wellness photo upload */}
              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ marginTop:0 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:C.sub, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:0.8 }}>Photo (optional)</label>
                  {wellnessPhotoUrl ? (
                    <div style={{ position:"relative", display:"inline-block" }}>
                      <img src={wellnessPhotoUrl} style={{ width:100, height:100, objectFit:"cover", borderRadius:12, border:`2px solid #2A3A2A` }} alt=""/>
                      <button onClick={() => setWellnessPhotoUrl(null)} style={{ position:"absolute", top:4, right:4, width:22, height:22, borderRadius:"50%", background:"rgba(0,0,0,0.7)", border:"none", color:"#fff", fontSize:12, cursor:"pointer" }}>·</button>
                    </div>
                  ) : (
                    <label style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 16px", borderRadius:12, border:`1.5px dashed #2A3A2A`, background:"#111", cursor:"pointer" }}>
                      <span style={{ fontSize:16 }}>➕</span>
                      <span style={{ fontSize:13, color:C.sub }}>Add photo</span>
                      <input type="file" accept="image/*" style={{ display:"none" }} onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const { uploadPhoto } = await import('@/lib/uploadPhoto');
                        const { compressImage } = await import('@/lib/compressImage');
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const dataUrl = ev.target!.result as string;
                          const path = `wellness/${Date.now()}.jpg`;
                          const compressed = await compressImage(dataUrl);
                          const url = await uploadPhoto(compressed, 'activity', path);
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
              <button onClick={handleSave} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading ? C.greenMid : `linear-gradient(135deg,${C.blue},#A78BFA)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving..." : "💾 Save to Log"}
              </button>
            </div>
          )}

        </>) : (

          /* --- SHARE TO FEED --- */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* -- Carousel photo area -- */}
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
                {carouselIdx > 0 && <button onClick={()=>setCarouselIdx(i=>i-1)} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer" }}>·</button>}
                {carouselIdx < feedPhotos.length-1 && <button onClick={()=>setCarouselIdx(i=>i+1)} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer" }}>·</button>}
                {/* Remove current */}
                <button onClick={()=>{ setFeedPhotos(p=>{ const n=[...p]; n.splice(carouselIdx,1); setCarouselIdx(Math.min(carouselIdx,n.length-1)); return n; }); }} style={{ position:"absolute",top:10,right:10,width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>·</button>
              </div>
            ) : (
              <label style={{ display:"block",cursor:"pointer" }}>
                <div style={{ border:`2px dashed ${C.greenMid}`,borderRadius:22,aspectRatio:"1/1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.greenLight,gap:12 }}>
                  <div style={{ fontSize:56 }}>🎉</div>
                  <div style={{ fontSize:17,fontWeight:800,color:C.blue }}>Add Photos or Videos</div>
                  <div style={{ fontSize:13,color:C.sub }}>Tap to upload · Select multiple</div>
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
                <span style={{ fontSize:16 }}>?</span>
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

            <button onClick={handlePost} disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading?C.greenMid:`linear-gradient(135deg,${C.blue},#A78BFA)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading?"not-allowed":"pointer" }}>
              {loading?"Posting...":"Post to Feed 🚀"}
            </button>
          </div>
        )}
        </div>{/* end post-main */}
      </div>{/* end post-layout */}

      {/* ── AI Food Scanner modal ───────────────────────────────
           Snap a food photo → AI estimates → user reviews + edits →
           items get pushed into the log AND the photo becomes the
           nutrition log's photo (so the activity card has the meal pic). */}
      {showAIScanner && user && (
        <AIFoodScanner
          userId={user.id}
          onClose={() => setShowAIScanner(false)}
          onResult={(items, photoDataUrl) => {
            // Append AI items to the existing food list (don't replace —
            // user might have already added items manually before scanning)
            setFoodItems(prev => [
              ...prev,
              ...items.map(it => ({
                name: it.name,
                calories: it.calories,
                protein: it.protein,
                carbs: it.carbs,
                fat: it.fat,
                servingSize: it.servingSize,
                qty: it.qty || "1",
              })),
            ]);
            // Photo becomes the nutrition log's photo. Only set if not
            // already set — don't overwrite if user already picked one.
            if (!nutPhoto) setNutPhoto(photoDataUrl);
          }}
        />
      )}
    </div>
  );
}



