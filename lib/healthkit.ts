// ─────────────────────────────────────────────────────────────────────────────
// lib/healthkit.ts
// ─────────────────────────────────────────────────────────────────────────────
// Apple Health integration for Livelee.
//
// Built on the `capacitor-health` plugin (Capacitor 8 compatible). The
// older @perfood/capacitor-healthkit plugin pegged Capacitor 4/5 and
// can't install in our build, so we use this newer cross-platform one
// which supports both HealthKit (iOS) and Health Connect (Android).
//
// Scope of data we pull on iOS:
//   - Workouts (with type, duration, distance, calories, heart rate)
//   - Daily steps
//   - Daily active calories burned
//   - Mindfulness minutes
//
// Weight, sleep, and standalone heart rate aren't exposed by this plugin's
// API yet. If we need them later we'll layer a second plugin or write a
// thin native bridge — not blocking ship for now.
//
// All public functions are no-ops on web. The /settings/healthkit page
// hides itself when isHealthKitAvailable() returns false.
// ─────────────────────────────────────────────────────────────────────────────

import { Capacitor } from '@capacitor/core';
import { Health, type HealthPermission } from 'capacitor-health';
import { supabase } from './supabase';

// localStorage keys, namespaced per user so account switching on the same
// device doesn't cross-contaminate sync state.
const LAST_SYNC_KEY_PREFIX = 'livelee_healthkit_last_sync_';
const CONNECTED_KEY_PREFIX = 'livelee_healthkit_connected_';

// ─── Capability detection ────────────────────────────────────────────────────
// We only run this integration on real iOS native — the plugin works on
// Android too but mapping Health Connect's quirks is out of scope here.
export function isHealthKitAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (!Capacitor.isNativePlatform()) return false;
  return Capacitor.getPlatform() === 'ios';
}

// ─── Permissions ────────────────────────────────────────────────────────────
const READ_PERMISSIONS: HealthPermission[] = [
  'READ_STEPS',
  'READ_WORKOUTS',
  'READ_ACTIVE_CALORIES',
  'READ_TOTAL_CALORIES',
  'READ_DISTANCE',
  'READ_HEART_RATE',
  'READ_MINDFULNESS',
];

/**
 * Prompts the user to grant Livelee access to HealthKit data.
 * Returns true iff the system call succeeded — note iOS intentionally
 * doesn't tell us which scopes were granted vs denied. We just try each
 * data type in runHealthKitSync and let empty responses indicate denial.
 */
export async function requestHealthKitPermissions(userId: string): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;
  try {
    await Health.requestHealthPermissions({ permissions: READ_PERMISSIONS });
    try {
      localStorage.setItem(CONNECTED_KEY_PREFIX + userId, '1');
    } catch {}
    return true;
  } catch (err) {
    console.error('[healthkit] permission request failed', err);
    return false;
  }
}

export function isHealthKitConnected(userId: string): boolean {
  if (!isHealthKitAvailable()) return false;
  try {
    return localStorage.getItem(CONNECTED_KEY_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

// ─── Workout type mapping ───────────────────────────────────────────────────
// The plugin returns workoutType as a normalized string. We map to Livelee's
// workout_category taxonomy. Unknown types fall through to 'lifting'.
function mapWorkoutType(hkType: string): {
  workout_type: string;
  workout_category: string;
} {
  const t = String(hkType || '').toLowerCase();
  if (t.includes('run')) return { workout_type: 'Run', workout_category: 'running' };
  if (t.includes('walk')) return { workout_type: 'Walk', workout_category: 'walking' };
  if (t.includes('hik')) return { workout_type: 'Hike', workout_category: 'walking' };
  if (t.includes('cycl') || t.includes('bik'))
    return { workout_type: 'Bike', workout_category: 'biking' };
  if (t.includes('swim')) return { workout_type: 'Swim', workout_category: 'swimming' };
  if (t.includes('row')) return { workout_type: 'Row', workout_category: 'rowing' };
  if (t.includes('yoga')) return { workout_type: 'Yoga', workout_category: 'yoga' };
  if (t.includes('strength') || t.includes('lifting') || t.includes('functional'))
    return { workout_type: 'Lifting', workout_category: 'lifting' };
  if (t.includes('hiit') || t.includes('crosstraining'))
    return { workout_type: 'HIIT', workout_category: 'hiit' };
  if (t.includes('cardio'))
    return { workout_type: 'Cardio', workout_category: 'cardio' };
  return { workout_type: hkType || 'Workout', workout_category: 'lifting' };
}

// ─── Date helpers ───────────────────────────────────────────────────────────
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isoDay(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

// ─── Sync result reporting ──────────────────────────────────────────────────
export interface SyncResult {
  ok: boolean;
  workouts: number;
  steps: number;
  calories: number;
  weights: number;   // kept in interface for UI compat; always 0 for now
  sleep: number;     // ditto
  heartRate: number; // ditto
  mindful: number;
  errors: string[];
}

const EMPTY_RESULT: SyncResult = {
  ok: false,
  workouts: 0,
  steps: 0,
  calories: 0,
  weights: 0,
  sleep: 0,
  heartRate: 0,
  mindful: 0,
  errors: [],
};

// ─── Sync window ────────────────────────────────────────────────────────────
const FIRST_SYNC_DAYS = 90;
const OVERLAP_HOURS = 24;

function getSyncStartDate(userId: string): Date {
  try {
    const stored = localStorage.getItem(LAST_SYNC_KEY_PREFIX + userId);
    if (stored) {
      const lastSync = new Date(stored);
      if (!isNaN(lastSync.getTime())) {
        return new Date(lastSync.getTime() - OVERLAP_HOURS * 3600 * 1000);
      }
    }
  } catch {}
  const fallback = new Date();
  fallback.setDate(fallback.getDate() - FIRST_SYNC_DAYS);
  return fallback;
}

function setLastSyncDate(userId: string, d: Date) {
  try {
    localStorage.setItem(LAST_SYNC_KEY_PREFIX + userId, d.toISOString());
  } catch {}
}

export function getLastSyncDate(userId: string): Date | null {
  try {
    const stored = localStorage.getItem(LAST_SYNC_KEY_PREFIX + userId);
    if (stored) {
      const d = new Date(stored);
      return isNaN(d.getTime()) ? null : d;
    }
  } catch {}
  return null;
}

// ─── Main sync function ─────────────────────────────────────────────────────
export async function runHealthKitSync(userId: string): Promise<SyncResult> {
  const result: SyncResult = { ...EMPTY_RESULT, errors: [] };
  if (!isHealthKitAvailable()) {
    result.errors.push('HealthKit is not available on this device.');
    return result;
  }

  const startDate = getSyncStartDate(userId);
  const endDate = new Date();
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  // ─── 1. WORKOUTS ─────────────────────────────────────────────────────────
  try {
    const { workouts } = await Health.queryWorkouts({
      startDate: startISO,
      endDate: endISO,
      includeHeartRate: true,
      includeRoute: false,
      includeSteps: false,
    });
    if (Array.isArray(workouts) && workouts.length > 0) {
      const rows = workouts.map(w => {
        const mapped = mapWorkoutType(w.workoutType);
        const durationMin = typeof w.duration === 'number'
          ? Math.round(w.duration / 60)
          : null;
        const miles = typeof w.distance === 'number' && w.distance > 0
          ? (w.distance / 1609.34).toFixed(2)
          : '';
        // Average heart rate from samples, if any.
        const hrSamples = Array.isArray(w.heartRate) ? w.heartRate : [];
        const avgHr = hrSamples.length > 0
          ? Math.round(hrSamples.reduce((s, h) => s + h.bpm, 0) / hrSamples.length)
          : null;
        return {
          user_id: userId,
          log_type: 'workout',
          logged_at: w.startDate,
          workout_type: mapped.workout_type,
          workout_category: mapped.workout_category,
          workout_duration_min: durationMin,
          workout_calories: typeof w.calories === 'number'
            ? Math.round(w.calories)
            : null,
          cardio: miles
            ? [{ type: mapped.workout_type, duration: durationMin ? `${durationMin}` : '', distance: miles, miles }]
            : [],
          notes: avgHr
            ? `Synced from ${w.sourceName || 'Apple Health'} • avg HR ${avgHr} bpm`
            : `Synced from ${w.sourceName || 'Apple Health'}`,
          external_id: w.id || null,
          external_source: 'healthkit',
        };
      }).filter(r => r.external_id);

      if (rows.length > 0) {
        const { error, count } = await supabase
          .from('activity_logs')
          .upsert(rows, {
            onConflict: 'user_id,external_source,external_id',
            ignoreDuplicates: true,
            count: 'exact',
          });
        if (error) result.errors.push(`workouts: ${error.message}`);
        else result.workouts = count || 0;
      }
    }
  } catch (err: any) {
    result.errors.push(`workouts: ${err?.message || err}`);
  }

  // ─── 2. STEPS (per day, aggregated by plugin) ────────────────────────────
  // bucket='day' returns one entry per day. We delete-then-insert so today's
  // step count overwrites the previous read (steps grow during the day).
  try {
    const { aggregatedData } = await Health.queryAggregated({
      startDate: startISO,
      endDate: endISO,
      dataType: 'steps',
      bucket: 'day',
    });
    if (Array.isArray(aggregatedData) && aggregatedData.length > 0) {
      const rows = aggregatedData
        .filter(s => s.value > 0)
        .map(s => {
          const day = isoDay(new Date(s.startDate));
          return {
            user_id: userId,
            log_type: 'wellness',
            logged_at: `${day}T12:00:00.000Z`,
            wellness_type: 'steps',
            wellness_duration_min: null,
            notes: `${Math.round(s.value).toLocaleString()} steps`,
            steps: Math.round(s.value),
            external_id: `steps_${day}`,
            external_source: 'healthkit',
          };
        });
      if (rows.length > 0) {
        const { error: delErr } = await supabase
          .from('activity_logs')
          .delete()
          .eq('user_id', userId)
          .eq('external_source', 'healthkit')
          .in('external_id', rows.map(r => r.external_id));
        if (delErr) result.errors.push(`steps cleanup: ${delErr.message}`);
        const { error, count } = await supabase
          .from('activity_logs')
          .insert(rows, { count: 'exact' });
        if (error) result.errors.push(`steps: ${error.message}`);
        else result.steps = count || 0;
      }
    }
  } catch (err: any) {
    result.errors.push(`steps: ${err?.message || err}`);
  }

  // ─── 3. ACTIVE CALORIES (per day) ────────────────────────────────────────
  try {
    const { aggregatedData } = await Health.queryAggregated({
      startDate: startISO,
      endDate: endISO,
      dataType: 'active-calories',
      bucket: 'day',
    });
    if (Array.isArray(aggregatedData) && aggregatedData.length > 0) {
      const rows = aggregatedData
        .filter(s => s.value > 0)
        .map(s => {
          const day = isoDay(new Date(s.startDate));
          return {
            user_id: userId,
            log_type: 'wellness',
            logged_at: `${day}T12:00:00.000Z`,
            wellness_type: 'calories_burned',
            wellness_duration_min: null,
            notes: `${Math.round(s.value)} active kcal`,
            calories_burned: Math.round(s.value),
            external_id: `calories_${day}`,
            external_source: 'healthkit',
          };
        });
      if (rows.length > 0) {
        const { error: delErr } = await supabase
          .from('activity_logs')
          .delete()
          .eq('user_id', userId)
          .eq('external_source', 'healthkit')
          .in('external_id', rows.map(r => r.external_id));
        if (delErr) result.errors.push(`calories cleanup: ${delErr.message}`);
        const { error, count } = await supabase
          .from('activity_logs')
          .insert(rows, { count: 'exact' });
        if (error) result.errors.push(`calories: ${error.message}`);
        else result.calories = count || 0;
      }
    }
  } catch (err: any) {
    result.errors.push(`calories: ${err?.message || err}`);
  }

  // ─── 4. MINDFULNESS (per day) ────────────────────────────────────────────
  try {
    const { aggregatedData } = await Health.queryAggregated({
      startDate: startISO,
      endDate: endISO,
      dataType: 'mindfulness',
      bucket: 'day',
    });
    if (Array.isArray(aggregatedData) && aggregatedData.length > 0) {
      const rows = aggregatedData
        .filter(s => s.value > 0)
        .map(s => {
          const day = isoDay(new Date(s.startDate));
          // Plugin returns mindfulness in seconds; we store minutes.
          const minutes = Math.round(s.value / 60);
          return {
            user_id: userId,
            log_type: 'wellness',
            logged_at: `${day}T20:00:00.000Z`,
            wellness_type: 'meditation',
            wellness_duration_min: minutes,
            notes: `${minutes} min mindfulness`,
            external_id: `mindful_${day}`,
            external_source: 'healthkit',
          };
        });
      if (rows.length > 0) {
        const { error: delErr } = await supabase
          .from('activity_logs')
          .delete()
          .eq('user_id', userId)
          .eq('external_source', 'healthkit')
          .in('external_id', rows.map(r => r.external_id));
        if (delErr) result.errors.push(`mindful cleanup: ${delErr.message}`);
        const { error, count } = await supabase
          .from('activity_logs')
          .insert(rows, { count: 'exact' });
        if (error) result.errors.push(`mindful: ${error.message}`);
        else result.mindful = count || 0;
      }
    }
  } catch (err: any) {
    result.errors.push(`mindful: ${err?.message || err}`);
  }

  // ─── DONE ────────────────────────────────────────────────────────────────
  result.ok = result.errors.length === 0;
  if (result.ok) setLastSyncDate(userId, endDate);
  return result;
}

// ─── Background auto-sync ────────────────────────────────────────────────────
const AUTO_SYNC_COOLDOWN_MS = 2 * 60 * 1000;

export async function maybeRunAutoSync(userId: string): Promise<void> {
  if (!isHealthKitAvailable()) return;
  if (!isHealthKitConnected(userId)) return;
  const last = getLastSyncDate(userId);
  if (last && Date.now() - last.getTime() < AUTO_SYNC_COOLDOWN_MS) return;
  runHealthKitSync(userId).catch(err => {
    console.error('[healthkit] auto-sync failed', err);
  });
}
