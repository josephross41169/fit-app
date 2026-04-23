"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { EXERCISES } from "@/lib/exercises";
import { syncGroupChallengeProgressFor } from "@/lib/groupGoalSync";

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
        const res = await fetch(url, { headers: { 'User-Agent': 'FitApp/1.0 (fitapp@example.com)' } });
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

const MOOD_EMOJIS = ["😊", "💪", "😴", "😤", "🔥"];
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
const WELLNESS_TYPES = ["Sleep", "Meditation", "Stretching", "Cold Plunge", "Sauna", "Breathwork", "Steam Room", "Foam Rolling", "Other"];
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
  const submittingRef = useRef(false); // hard lock · prevents double-submit even with rapid clicks

  // Workout state
  const [woCategory, setWoCategory] = useState("lifting"); // standardized category; drives form fields
  const [woType, setWoType] = useState("");                 // user-facing workout NAME ("Push Day A")
  const [woDuration, setWoDuration] = useState("");
  const [woDistance, setWoDistance] = useState("");         // distance for cardio categories
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [prevSessions, setPrevSessions] = useState<Record<string, PrevSession | null>>({});
  const [cardioType, setCardioType] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [woNotes, setWoNotes] = useState("");
  const [woPhoto, setWoPhoto] = useState<string | null>(null);

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
  const [mealPhotos, setMealPhotos] = useState<Record<string, string>>({});
  // Macro goals & daily tracking
  const [macroGoals, setMacroGoals] = useState<NutritionGoals | null>(null);
  const [dailyTotals, setDailyTotals] = useState<DailyTotals | null>(null);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [showGoalsEditor, setShowGoalsEditor] = useState(false);
  const [editGoals, setEditGoals] = useState<NutritionGoals>({ calories: 2500, protein: 180, carbs: 250, fat: 70, water_oz: 100 });

  // Wellness state
  const [wellnessType, setWellnessType] = useState("Meditation");
  const [wellnessDuration, setWellnessDuration] = useState("");
  const [wellnessNotes, setWellnessNotes] = useState("");
  const [mood, setMood] = useState("");
  const [wellnessPhotoUrl, setWellnessPhotoUrl] = useState<string | null>(null);
  // Extended wellness tracking fields
  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [sleepBedtime, setSleepBedtime] = useState("");
  const [sleepWakeTime, setSleepWakeTime] = useState("");
  const [steps, setSteps] = useState("");
  const [hrv, setHrv] = useState("");
  const [restingHR, setRestingHR] = useState("");

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
      setWoDuration(data.workout_duration_min ? String(data.workout_duration_min) : '');
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
          notes: ex.notes || undefined,
        }));

        // Build the cardio array based on the selected category's fields.
        // For distance-based categories (running/walking/biking/swimming/rowing),
        // save {miles, duration, pace} — matching what the rivalry scoring
        // function and legacy code already expect (cardio.miles, cardio.pace_min_per_mile).
        const selectedCat = WORKOUT_CATEGORIES.find(c => c.id === woCategory);
        let cardioPayload: any = null;
        if (selectedCat?.distance && (woDistance || woDuration)) {
          const distNum = parseFloat(woDistance) || 0;
          const durNum  = parseFloat(woDuration)  || 0;
          const cardioEntry: any = {
            type: woCategory,
            distance: woDistance || null,
            duration: woDuration || null,
          };
          if (distNum > 0) cardioEntry.miles = distNum;
          if (distNum > 0 && durNum > 0) {
            // Auto-compute pace when both fields are present
            if (woCategory === "running") {
              cardioEntry.pace_min_per_mile = durNum / distNum;
            } else if (woCategory === "biking") {
              cardioEntry.mph = (distNum / durNum) * 60;
            } else if (woCategory === "swimming") {
              // min per 100 yards
              cardioEntry.pace_min_per_100 = (durNum / distNum) * 100;
            }
          }
          cardioPayload = [cardioEntry];
        }
        // Preserve legacy standalone cardio fields if user filled them (backwards compat)
        else if (cardioType || cardioDuration || cardioDistance) {
          cardioPayload = [{ type: cardioType, duration: cardioDuration, distance: cardioDistance }];
        }

        const workoutPayload = {
          workout_category: woCategory,                 // standardized — drives stats/badges/rivalries
          workout_type: woType || null,                  // user's name for this workout ("Push Day A")
          workout_duration_min: woDuration ? parseInt(woDuration) : null,
          exercises: normalizedExercises.length > 0 ? normalizedExercises : null,
          cardio: cardioPayload,
          notes: woNotes || null,
          photo_url: woPhotoUrl,
          source: 'manual',                              // future wearables will set 'fitbit'/'apple-watch'/etc.
        };
        // If resuming today's log, update it instead of inserting a new one
        const res = todayLogId
          ? await supabase.from('activity_logs').update(workoutPayload).eq('id', todayLogId)
          : await supabase.from('activity_logs').insert({ ...base, log_type: 'workout', ...workoutPayload });
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
        // Upload wellness photo if present
        let wellnessUploadedUrl: string | null = null;
        if (wellnessPhotoUrl) {
          wellnessUploadedUrl = await uploadPhoto(wellnessPhotoUrl, 'activity', `${user.id}/wellness-${Date.now()}.jpg`);
        }
        // Build extended wellness_data object
        const wellnessData: Record<string, any> = {};
        if (wellnessType === 'Sleep') {
          if (sleepHours) wellnessData.sleep_hours = parseFloat(sleepHours);
          if (sleepQuality !== null) wellnessData.sleep_quality = sleepQuality;
          if (sleepBedtime) wellnessData.sleep_bedtime = sleepBedtime;
          if (sleepWakeTime) wellnessData.sleep_wake_time = sleepWakeTime;
        }
        if (steps) wellnessData.steps = parseInt(steps);
        if (hrv) wellnessData.hrv = parseInt(hrv);
        if (restingHR) wellnessData.resting_hr = parseInt(restingHR);
        const res = await supabase.from('activity_logs').insert({
          ...base,
          log_type: 'wellness',
          wellness_type: wellnessType,
          wellness_duration_min: wellnessDuration ? parseInt(wellnessDuration) : null,
          mood: mood || null,
          notes: wellnessNotes || null,
          photo_url: wellnessUploadedUrl || null,
          // wellness_data omitted — column requires migration: lib/migration-wellness-data.sql
        });
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
      // the free-text workout name.
      try { await awardActivityBadges(user.id, logTab, wellnessType, cardioType, woType, woCategory, exercises); } catch {}
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
    // Upsert helper — a no-op if the badge row already exists
    async function award(badgeId: string) {
      await supabase.from('badges').upsert(
        { user_id: userId, badge_id: badgeId },
        { onConflict: 'user_id,badge_id', ignoreDuplicates: true }
      );
    }

    // Count logs matching a filter. Supports eq and ilike via 'ilike:' prefix.
    async function countLogs(filters: Record<string, any>): Promise<number> {
      let q = supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      for (const [key, val] of Object.entries(filters)) {
        if (typeof val === 'string' && val.startsWith('ilike:')) {
          q = (q as any).ilike(key, val.replace('ilike:', ''));
        } else {
          q = (q as any).eq(key, val);
        }
      }
      const { count } = await q;
      return count || 0;
    }

    if (tab === 'workout') {
      // ── Total workouts (8 tiers: 1/10/25/50/100/200/500/1000) ─────────
      const totalWorkouts = await countLogs({ log_type: 'workout' });
      if (totalWorkouts >= 1)    await award('first-workout');
      if (totalWorkouts >= 10)   await award('workouts-10');
      if (totalWorkouts >= 25)   await award('workouts-25');
      if (totalWorkouts >= 50)   await award('centurion-half');
      if (totalWorkouts >= 100)  await award('centurion');
      if (totalWorkouts >= 200)  await award('centurion-2x');
      if (totalWorkouts >= 500)  await award('500-workouts');
      if (totalWorkouts >= 1000) await award('1000-workouts');

      // ── Running (8 tiers: 1/5/20/50/100/200/500/1000) ─────────────────
      if (woCat === 'running') {
        const runCount = await countLogs({ log_type: 'workout', workout_category: 'running' });
        if (runCount >= 1)    await award('first-run');
        if (runCount >= 5)    await award('runs-5');
        if (runCount >= 20)   await award('runs-20');
        if (runCount >= 50)   await award('runs-50');
        if (runCount >= 100)  await award('runs-100');
        if (runCount >= 200)  await award('runs-200');
        if (runCount >= 500)  await award('runs-500');
        if (runCount >= 1000) await award('runs-1000');
      }

      // ── Lifting (8 tiers: 1/10/25/50/100/200/500/1000) ────────────────
      if (woCat === 'lifting') {
        const liftCount = await countLogs({ log_type: 'workout', workout_category: 'lifting' });
        if (liftCount >= 1)    await award('first-lift');
        if (liftCount >= 10)   await award('lifts-10');
        if (liftCount >= 25)   await award('lifts-25');
        if (liftCount >= 50)   await award('lifts-50');
        if (liftCount >= 100)  await award('lifts-100');
        if (liftCount >= 200)  await award('lifts-200');
        if (liftCount >= 500)  await award('lifts-500');
        if (liftCount >= 1000) await award('lifts-1000');
      }

      // ── Yoga (now a workout category) ─────────────────────────────────
      if (woCat === 'yoga') {
        const yogaCount = await countLogs({ log_type: 'workout', workout_category: 'yoga' });
        if (yogaCount >= 1)   await award('first-yoga');
        if (yogaCount >= 10)  await award('yoga-10');
        if (yogaCount >= 30)  await award('yoga-lover');
        if (yogaCount >= 100) await award('yoga-queen');
      }

      // ── Walking (now a workout category) ──────────────────────────────
      if (woCat === 'walking') {
        const walkCount = await countLogs({ log_type: 'workout', workout_category: 'walking' });
        if (walkCount >= 1)   await award('first-walk');
        if (walkCount >= 10)  await award('nature-walk');
        if (walkCount >= 50)  await award('walks-50');
      }
    }

    if (tab === 'wellness') {
      // Wellness still uses free-text wellness_type (Title Case values like
      // "Cold Plunge", "Sauna"). We match case-insensitively to handle
      // whatever the form writes.
      const wTypeLower = wType.toLowerCase();
      const { count: wCount } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('log_type', 'wellness')
        .ilike('wellness_type', `%${wType}%`);
      const typeCount = wCount || 0;

      // Meditation
      if (wTypeLower.includes('meditat')) {
        if (typeCount >= 1)   await award('first-meditation');
        if (typeCount >= 10)  await award('meditation-10');
        if (typeCount >= 30)  await award('meditation-master');
      }
      // Cold Plunge / Ice Bath
      if (wTypeLower.includes('cold') || wTypeLower.includes('ice') || wTypeLower.includes('plunge')) {
        if (typeCount >= 1)   await award('first-cold-plunge');
        if (typeCount >= 5)   await award('ice-bath');
        if (typeCount >= 20)  await award('cold-plunge-20');
        if (typeCount >= 50)  await award('ice-warrior');
      }
      // Sauna
      if (wTypeLower.includes('sauna')) {
        if (typeCount >= 1)   await award('first-sauna');
        if (typeCount >= 10)  await award('sauna');
        if (typeCount >= 30)  await award('sauna-30');
      }
      // Breathwork
      if (wTypeLower.includes('breath')) {
        if (typeCount >= 1)   await award('first-breathwork');
        if (typeCount >= 10)  await award('breathwork');
        if (typeCount >= 30)  await award('breathwork-30');
      }
      // Stretching
      if (wTypeLower.includes('stretch')) {
        if (typeCount >= 1)   await award('first-stretch');
        if (typeCount >= 20)  await award('stretch-it-out');
      }

      // Total wellness logs
      const totalWellness = await countLogs({ log_type: 'wellness' });
      if (totalWellness >= 10) await award('wellness-10');
      if (totalWellness >= 50) await award('wellness-50');
    }

    if (tab === 'nutrition') {
      const totalNutrition = await countLogs({ log_type: 'nutrition' });
      if (totalNutrition >= 1)   await award('first-nutrition-log');
      if (totalNutrition >= 7)   await award('nutrition-week');
      if (totalNutrition >= 14)  await award('nutrition-pro');
      if (totalNutrition >= 100) await award('nutrition-100');
    }
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

  if (saved) {
    setTimeout(() => router.push("/profile"), newPRs.length > 0 ? 3000 : 1500);
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 24px" }}>
        <div style={{ fontSize: 64 }}>{newPRs.length > 0 ? "🏆" : "✓"}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.blue }}>
          {newPRs.length > 0 ? `${newPRs.length} New PR${newPRs.length > 1 ? "s" : ""}! 🎉` : "Saved to Log!"}
        </div>
        {newPRs.length > 0 && (
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
        <div style={{ fontSize: 14, color: C.sub, marginTop: 8 }}>{isPrivate ? "🔒 Saved privately" : "🌐 Visible on your profile"}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Taking you to your profile...</div>
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

      {/* Mobile header */}
      <div className="post-mobile-header" style={{ background: C.white, borderBottom: `2px solid ${C.greenMid}`, padding: "20px 20px 0" }}>
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

              {/* -- Resume today's workout banner -- */}
              {todayLog && !todayLogId && (
                <div style={{ background: "linear-gradient(135deg, #1A1228, #2D1B69)", borderRadius: 18, padding: "14px 18px", border: `2px solid ${C.blue}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#F0F0F0" }}>? Continue today's workout</div>
                    <div style={{ fontSize: 12, color: "#A78BFA", marginTop: 3 }}>{todayLog.type} · already logged today. Add more exercises or update it.</div>
                  </div>
                  <button
                    onClick={resumeTodayWorkout}
                    style={{ padding: "9px 16px", borderRadius: 14, border: "none", background: C.blue, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
                    Continue ?
                  </button>
                </div>
              )}

              {/* Resume mode indicator */}
              {todayLogId && (
                <div style={{ background: "#0D1A0D", borderRadius: 14, padding: "10px 16px", border: "2px solid #7C3AED", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, color: "#4ADE80", fontWeight: 700 }}>✏️ Editing today's {todayLog?.type || 'workout'} · save will update it</div>
                  <button onClick={() => { setTodayLogId(null); setExercises([]); setWoType(''); setWoCategory('lifting'); setWoDuration(''); setWoDistance(''); setWoNotes(''); }} style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>Start fresh instead</button>
                </div>
              )}

              <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>💪 Workout Details</div>

                {/* Category — drives which fields appear below */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Category</label>
                  <select style={iStyle} value={woCategory} onChange={e => setWoCategory(e.target.value)}>
                    {WORKOUT_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.emoji}  {c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Name — optional user label like "Push Day A" or "Morning 5K" */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Workout Name <span style={{ color: C.sub, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <input style={iStyle} placeholder={`e.g. ${woCategory === 'lifting' ? 'Push Day A' : woCategory === 'running' ? 'Morning 5K' : 'Give it a name'}`} value={woType} onChange={e => setWoType(e.target.value)} />
                </div>

                {(() => {
                  const cat = WORKOUT_CATEGORIES.find(c => c.id === woCategory);
                  if (!cat) return null;
                  // Pace auto-calculated from distance + duration
                  const distNum = parseFloat(woDistance) || 0;
                  const durNum  = parseFloat(woDuration)  || 0;
                  let paceText = "";
                  if (cat.pace && distNum > 0 && durNum > 0) {
                    if (cat.id === "running") {
                      const p = durNum / distNum;
                      const m = Math.floor(p);
                      const s = Math.round((p - m) * 60);
                      paceText = `${m}:${s.toString().padStart(2, "0")} min/mi`;
                    } else if (cat.id === "biking") {
                      paceText = `${((distNum / durNum) * 60).toFixed(1)} mph`;
                    } else if (cat.id === "swimming") {
                      const p = (durNum / distNum) * 100;
                      const m = Math.floor(p);
                      const s = Math.round((p - m) * 60);
                      paceText = `${m}:${s.toString().padStart(2, "0")} min/100yd`;
                    }
                  }
                  return (
                    <>
                      {/* Duration — every category uses this */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>Duration (min)</label>
                        <input style={iStyle} type="text" inputMode="numeric" placeholder="e.g. 45" value={woDuration} onChange={e => setWoDuration(e.target.value)} />
                      </div>

                      {/* Distance — only for categories that support it */}
                      {cat.distance && (
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                            Distance ({cat.distanceUnit})
                          </label>
                          <input style={iStyle} type="text" inputMode="decimal" placeholder={cat.id === "swimming" ? "e.g. 1000" : cat.id === "rowing" ? "e.g. 2000" : "e.g. 3.2"} value={woDistance} onChange={e => setWoDistance(e.target.value)} />
                        </div>
                      )}

                      {/* Auto-computed pace — read-only display */}
                      {cat.pace && (
                        <div style={{ marginBottom: 12, background: "#0D0D0D", borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.greenMid}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>
                            Pace · auto-calculated
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: paceText ? C.gold : C.sub }}>
                            {paceText || "Enter distance + duration"}
                          </div>
                        </div>
                      )}
                    </>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Food Items</div>
                  <button onClick={() => setFoodItems(f => [...f, { name: "", calories: "" }])}
                    style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.blue}`, background: C.greenLight, color: C.blue, cursor: "pointer" }}>
                    + Manual
                  </button>
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
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14 }}>🧘 Wellness Activity</div>
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

                {/* Sleep-specific fields */}
                {wellnessType === 'Sleep' && (
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

                {/* Steps, HRV, Resting HR */}
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
                      <button onClick={() => setWellnessPhotoUrl(null)} style={{ position:"absolute", top:4, right:4, width:22, height:22, borderRadius:"50%", background:"rgba(0,0,0,0.7)", border:"none", color:"#fff", fontSize:12, cursor:"pointer" }}>·</button>
                    </div>
                  ) : (
                    <label style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 16px", borderRadius:12, border:`1.5px dashed #2A3A2A`, background:"#111", cursor:"pointer" }}>
                      <span style={{ fontSize:16 }}>➕</span>
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
    </div>
  );
}



