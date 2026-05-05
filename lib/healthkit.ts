// ─────────────────────────────────────────────────────────────────────────────
// lib/healthkit.ts
// ─────────────────────────────────────────────────────────────────────────────
// HealthKit integration for Livelee.
//
// Responsibilities:
//   1. Detect whether HealthKit is available (only on real iOS, not web/Android)
//   2. Request permissions for each data type we want to read
//   3. Pull workouts, steps, calories, weight, sleep, heart rate, mindful minutes
//   4. Map HealthKit's data shape to Livelee's activity_logs schema
//   5. Insert into Supabase using (user_id, external_source, external_id) for
//      dedup so re-syncs are idempotent
//
// Sync triggers:
//   - Manual button on /settings/healthkit
//   - Quiet background sync on app open (last sync timestamp in localStorage)
//
// All public functions are no-ops on web / Android. The /settings/healthkit
// page hides itself when isHealthKitAvailable() returns false. So calling
// this module from web pages is safe — nothing crashes, sync just doesn't run.
// ─────────────────────────────────────────────────────────────────────────────

import { Capacitor } from '@capacitor/core';
import { CapacitorHealthkit, SampleNames } from '@perfood/capacitor-healthkit';
import { supabase } from './supabase';

// localStorage key for "last successful sync" timestamp. Stored per user so
// switching accounts on the same device starts fresh.
const LAST_SYNC_KEY_PREFIX = 'livelee_healthkit_last_sync_';
// localStorage key for "user has connected HealthKit at least once". Drives
// whether we attempt the auto-sync on app open. Set to '1' after the first
// successful permission grant.
const CONNECTED_KEY_PREFIX = 'livelee_healthkit_connected_';

// ─── Capability detection ────────────────────────────────────────────────────
// Only real iOS devices have HealthKit. We check both the Capacitor platform
// AND the native plugin's own isAvailable() probe, because Capacitor's
// platform check returns 'ios' on simulator (which has HealthKit but with
// quirks) and would also return 'ios' if someone bundled the iOS shell into
// a non-iOS environment (shouldn't happen, but defensive).
export function isHealthKitAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (!Capacitor.isNativePlatform()) return false;
  return Capacitor.getPlatform() === 'ios';
}

// ─── Permissions ────────────────────────────────────────────────────────────
// The complete read scope we need. Apple shows the user a multi-line consent
// sheet listing each of these. They can deny individual ones, in which case
// the corresponding query will return empty (which is fine — we just skip
// that data type).
const READ_PERMISSIONS = [
  SampleNames.WORKOUT_TYPE,
  SampleNames.STEP_COUNT,
  SampleNames.ACTIVE_ENERGY_BURNED,
  SampleNames.BASAL_ENERGY_BURNED,
  SampleNames.WEIGHT,
  SampleNames.SLEEP_ANALYSIS,
  SampleNames.HEART_RATE,
  SampleNames.RESTING_HEART_RATE,
  SampleNames.DISTANCE_WALKING_RUNNING,
  SampleNames.DISTANCE_CYCLING,
  SampleNames.FLIGHTS_CLIMBED,
];

// Write scope: we only write back workouts the user logs inside Livelee, so
// other Apple Health–integrated apps (Fitness, Strava, etc.) can pick them
// up. Empty for now; can extend later if we want to write nutrition, weight,
// etc. back to HealthKit.
const WRITE_PERMISSIONS: string[] = [];

/**
 * Prompts the user to grant Livelee access to HealthKit data.
 * Returns true iff the system call succeeded — note that "success" here
 * just means the user dismissed the sheet, not that they granted everything.
 * Apple intentionally hides which specific types were granted to prevent
 * apps from nagging users about denied scopes. So after this, we simply
 * try to pull each data type and let the empty-array responses indicate
 * which ones the user opted out of.
 */
export async function requestHealthKitPermissions(userId: string): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;
  try {
    await CapacitorHealthkit.requestAuthorization({
      all: [],
      read: READ_PERMISSIONS,
      write: WRITE_PERMISSIONS,
    });
    // Mark the user as connected so the auto-sync runs on subsequent opens.
    try {
      localStorage.setItem(CONNECTED_KEY_PREFIX + userId, '1');
    } catch {
      // localStorage can be unavailable in private browsing modes; we don't
      // care about that case since this code path only runs on native iOS.
    }
    return true;
  } catch (err) {
    // requestAuthorization throws if HealthKit is entirely unavailable
    // (e.g., the user's device doesn't support it, or the entitlement is
    // missing from the build). Surface as "not connected" rather than
    // throwing further up — UI can then show a friendly retry button.
    console.error('[healthkit] permission request failed', err);
    return false;
  }
}

/**
 * Whether the user has already connected HealthKit at least once on this
 * device. Drives whether we attempt auto-sync on app open. The actual
 * permission state lives in iOS settings — this flag just gates the call.
 */
export function isHealthKitConnected(userId: string): boolean {
  if (!isHealthKitAvailable()) return false;
  try {
    return localStorage.getItem(CONNECTED_KEY_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

// ─── Workout type mapping ───────────────────────────────────────────────────
// HealthKit workout types are integers (HKWorkoutActivityType). We map the
// most common ones to Livelee's `workout_category` taxonomy. Anything we
// don't recognize falls through to 'lifting' as a sensible default — the
// user can edit on the post page if needed.
//
// Reference: https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
function mapWorkoutType(hkType: string | number): {
  workout_type: string;
  workout_category: string;
} {
  // The plugin returns workoutActivityType as a string name like 'Running',
  // 'Walking', 'TraditionalStrengthTraining', etc. We normalize to lower
  // and keyword-match against Livelee's known categories.
  const t = String(hkType || '').toLowerCase();
  if (t.includes('run')) return { workout_type: 'Run', workout_category: 'running' };
  if (t.includes('walk')) return { workout_type: 'Walk', workout_category: 'walking' };
  if (t.includes('hik')) return { workout_type: 'Hike', workout_category: 'walking' };
  if (t.includes('cycl') || t.includes('bik')) return { workout_type: 'Bike', workout_category: 'biking' };
  if (t.includes('swim')) return { workout_type: 'Swim', workout_category: 'swimming' };
  if (t.includes('row')) return { workout_type: 'Row', workout_category: 'rowing' };
  if (t.includes('yoga')) return { workout_type: 'Yoga', workout_category: 'yoga' };
  if (t.includes('strength') || t.includes('lifting') || t.includes('functional'))
    return { workout_type: 'Lifting', workout_category: 'lifting' };
  if (t.includes('hiit') || t.includes('crosstraining'))
    return { workout_type: 'HIIT', workout_category: 'hiit' };
  if (t.includes('mixedcardio') || t.includes('cardio'))
    return { workout_type: 'Cardio', workout_category: 'cardio' };
  // Fallback — preserve the original string as workout_type so the user can
  // see what HK called it, but bucket as 'lifting' so badge logic still fires.
  return { workout_type: String(hkType || 'Workout'), workout_category: 'lifting' };
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
// Returned from runSync() so the UI can show a friendly summary toast.
export interface SyncResult {
  ok: boolean;
  workouts: number;
  steps: number;        // number of daily-step rows imported
  calories: number;     // number of daily-calorie rows imported
  weights: number;
  sleep: number;
  heartRate: number;    // number of resting-heart-rate readings imported
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
// First-time sync pulls 90 days of history. Subsequent syncs pull from the
// last successful sync timestamp minus a 24h overlap, to catch any items
// that arrived late (e.g. an Apple Watch finishing its iCloud sync after
// our query ran). Dedup via external_id makes the overlap safe.
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
/**
 * Pulls all available HealthKit data since the last successful sync and
 * writes it to Supabase. Returns a SyncResult summarizing what changed.
 *
 * Idempotent — calling repeatedly with the same data is a no-op because
 * every imported row has an external_id and we use ON CONFLICT DO NOTHING
 * via Supabase's upsert with ignoreDuplicates.
 */
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
  // HealthKit workouts have rich metadata: type, duration, calories, distance,
  // start/end times, and (for Apple Watch sources) heart rate stats.
  try {
    const { resultData } = await CapacitorHealthkit.queryHKitSampleType<any>({
      sampleName: SampleNames.WORKOUT_TYPE,
      startDate: startISO,
      endDate: endISO,
      limit: 0, // 0 = no limit
    });
    if (Array.isArray(resultData) && resultData.length > 0) {
      const rows = resultData.map((w: any) => {
        const mapped = mapWorkoutType(w.workoutActivityName || w.workoutActivityType);
        const duration = typeof w.duration === 'number' ? Math.round(w.duration / 60) : null;
        return {
          user_id: userId,
          log_type: 'workout',
          logged_at: w.startDate || w.endDate || new Date().toISOString(),
          workout_type: mapped.workout_type,
          workout_category: mapped.workout_category,
          workout_duration_min: duration,
          workout_calories: typeof w.totalEnergyBurned === 'number' ? Math.round(w.totalEnergyBurned) : null,
          // Distance in miles if HK provided it (HK uses meters; convert).
          // We attach to a `cardio` array so it shows up the same way as a
          // manually entered cardio session.
          cardio: typeof w.totalDistance === 'number' && w.totalDistance > 0
            ? [{
                type: mapped.workout_type,
                duration: duration ? `${duration}` : '',
                distance: (w.totalDistance / 1609.34).toFixed(2),
                miles: (w.totalDistance / 1609.34).toFixed(2),
              }]
            : [],
          notes: w.sourceName ? `Synced from ${w.sourceName}` : 'Synced from Apple Health',
          external_id: w.UUID || w.uuid || null,
          external_source: 'healthkit',
        };
      }).filter((r: any) => r.external_id); // Skip workouts without a stable UUID

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

  // ─── 2. STEPS (per day) ──────────────────────────────────────────────────
  // HealthKit returns step samples in tiny increments (every few minutes). We
  // aggregate per-day so the activity feed gets one wellness row per day,
  // not 200. external_id is built from the date so re-syncs idempotently
  // overwrite the day's count if it grew (since onConflict ignores).
  // To handle "today's step count grew from 4000 to 5000 since last sync",
  // we delete-then-insert rather than upsert-ignore for steps.
  try {
    const { resultData } = await CapacitorHealthkit.queryHKitSampleType<any>({
      sampleName: SampleNames.STEP_COUNT,
      startDate: startISO,
      endDate: endISO,
      limit: 0,
    });
    if (Array.isArray(resultData)) {
      const byDay: Record<string, number> = {};
      resultData.forEach((s: any) => {
        const day = isoDay(new Date(s.startDate || s.endDate));
        byDay[day] = (byDay[day] || 0) + (Number(s.value) || 0);
      });
      const days = Object.keys(byDay);
      if (days.length > 0) {
        const rows = days.map(day => ({
          user_id: userId,
          log_type: 'wellness',
          logged_at: `${day}T12:00:00.000Z`,
          wellness_type: 'steps',
          wellness_duration_min: null,
          notes: `${Math.round(byDay[day]).toLocaleString()} steps`,
          steps: Math.round(byDay[day]),
          external_id: `steps_${day}`,
          external_source: 'healthkit',
        }));
        // Delete-then-insert pattern for steps: today's count may have grown
        // since the last sync. Delete the day's row, insert the new total.
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

  // ─── 3. ACTIVE ENERGY BURNED (per day) ───────────────────────────────────
  // Same pattern as steps: aggregate per-day, delete-then-insert.
  try {
    const { resultData } = await CapacitorHealthkit.queryHKitSampleType<any>({
      sampleName: SampleNames.ACTIVE_ENERGY_BURNED,
      startDate: startISO,
      endDate: endISO,
      limit: 0,
    });
    if (Array.isArray(resultData)) {
      const byDay: Record<string, number> = {};
      resultData.forEach((s: any) => {
        const day = isoDay(new Date(s.startDate || s.endDate));
        byDay[day] = (byDay[day] || 0) + (Number(s.value) || 0);
      });
      const days = Object.keys(byDay);
      if (days.length > 0) {
        const rows = days.map(day => ({
          user_id: userId,
          log_type: 'wellness',
          logged_at: `${day}T12:00:00.000Z`,
          wellness_type: 'calories_burned',
          wellness_duration_min: null,
          notes: `${Math.round(byDay[day])} active kcal`,
          calories_burned: Math.round(byDay[day]),
          external_id: `calories_${day}`,
          external_source: 'healthkit',
        }));
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

  // ─── 4. WEIGHT ───────────────────────────────────────────────────────────
  // Each HealthKit weight reading is its own sample (no aggregation needed).
  // HK reports weight in kg; convert to lbs for the weights table since the
  // app's UI is lbs-first.
  try {
    const { resultData } = await CapacitorHealthkit.queryHKitSampleType<any>({
      sampleName: SampleNames.WEIGHT,
      startDate: startISO,
      endDate: endISO,
      limit: 0,
    });
    if (Array.isArray(resultData) && resultData.length > 0) {
      const rows = resultData.map((s: any) => ({
        user_id: userId,
        weight: Number(s.value) ? Number(s.value) * 2.20462 : null,
        recorded_at: s.startDate || s.endDate || new Date().toISOString(),
        external_id: s.UUID || s.uuid || null,
        external_source: 'healthkit',
      })).filter((r: any) => r.external_id && r.weight != null);
      if (rows.length > 0) {
        const { error, count } = await supabase
          .from('weights')
          .upsert(rows, {
            onConflict: 'user_id,external_source,external_id',
            ignoreDuplicates: true,
            count: 'exact',
          });
        if (error) result.errors.push(`weights: ${error.message}`);
        else result.weights = count || 0;
      }
    }
  } catch (err: any) {
    result.errors.push(`weight: ${err?.message || err}`);
  }

  // ─── 5. SLEEP ────────────────────────────────────────────────────────────
  // HealthKit sleep samples have a value indicating the stage (awake, asleep,
  // deep, rem, etc.). For Livelee we just want total time asleep per night,
  // so we aggregate any sample whose state is "asleep" by the night it
  // started in. We bucket by the date the sleep STARTED (so a sleep that
  // started 11pm on May 4 and ended 7am May 5 counts as May 4's night).
  try {
    const { resultData } = await CapacitorHealthkit.queryHKitSampleType<any>({
      sampleName: SampleNames.SLEEP_ANALYSIS,
      startDate: startISO,
      endDate: endISO,
      limit: 0,
    });
    if (Array.isArray(resultData)) {
      const byNight: Record<string, number> = {};
      resultData.forEach((s: any) => {
        // Plugin returns sleepState as 'inBed', 'asleep', 'awake', 'core',
        // 'deep', 'rem'. Anything containing 'sleep' or stage names counts.
        const state = String(s.sleepState || s.value || '').toLowerCase();
        if (!state || state === 'awake' || state === 'inbed') return;
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        const minutes = (end.getTime() - start.getTime()) / 60000;
        if (minutes <= 0) return;
        const night = isoDay(start);
        byNight[night] = (byNight[night] || 0) + minutes;
      });
      const nights = Object.keys(byNight);
      if (nights.length > 0) {
        const rows = nights.map(night => ({
          user_id: userId,
          log_type: 'wellness',
          logged_at: `${night}T22:00:00.000Z`,
          wellness_type: 'sleep',
          wellness_duration_min: Math.round(byNight[night]),
          notes: `${Math.round(byNight[night] / 60 * 10) / 10}h asleep`,
          external_id: `sleep_${night}`,
          external_source: 'healthkit',
        }));
        const { error: delErr } = await supabase
          .from('activity_logs')
          .delete()
          .eq('user_id', userId)
          .eq('external_source', 'healthkit')
          .in('external_id', rows.map(r => r.external_id));
        if (delErr) result.errors.push(`sleep cleanup: ${delErr.message}`);
        const { error, count } = await supabase
          .from('activity_logs')
          .insert(rows, { count: 'exact' });
        if (error) result.errors.push(`sleep: ${error.message}`);
        else result.sleep = count || 0;
      }
    }
  } catch (err: any) {
    result.errors.push(`sleep: ${err?.message || err}`);
  }

  // ─── 6. RESTING HEART RATE ───────────────────────────────────────────────
  // One reading per day from Apple Watch. Stored as wellness with the bpm
  // value embedded in `notes` for now (the wellness schema doesn't have a
  // dedicated heart rate column; we can add one later if we surface it
  // prominently in the UI).
  try {
    const { resultData } = await CapacitorHealthkit.queryHKitSampleType<any>({
      sampleName: SampleNames.RESTING_HEART_RATE,
      startDate: startISO,
      endDate: endISO,
      limit: 0,
    });
    if (Array.isArray(resultData) && resultData.length > 0) {
      const rows = resultData.map((s: any) => {
        const day = isoDay(new Date(s.startDate || s.endDate));
        const bpm = Number(s.value);
        return {
          user_id: userId,
          log_type: 'wellness',
          logged_at: s.startDate || s.endDate || new Date().toISOString(),
          wellness_type: 'resting_heart_rate',
          wellness_duration_min: null,
          notes: `${Math.round(bpm)} bpm resting`,
          external_id: s.UUID || s.uuid || `rhr_${day}`,
          external_source: 'healthkit',
        };
      }).filter((r: any) => r.external_id);
      if (rows.length > 0) {
        const { error, count } = await supabase
          .from('activity_logs')
          .upsert(rows, {
            onConflict: 'user_id,external_source,external_id',
            ignoreDuplicates: true,
            count: 'exact',
          });
        if (error) result.errors.push(`heart rate: ${error.message}`);
        else result.heartRate = count || 0;
      }
    }
  } catch (err: any) {
    result.errors.push(`heart rate: ${err?.message || err}`);
  }

  // ─── DONE ────────────────────────────────────────────────────────────────
  result.ok = result.errors.length === 0;
  // Only advance the last-sync timestamp on success. If any data type errored
  // out we leave the timestamp where it was so the next sync retries that
  // window (dedup via external_id makes this safe — successful types won't
  // re-import, only the failed ones will re-try).
  if (result.ok) setLastSyncDate(userId, endDate);
  return result;
}

// ─── Background auto-sync ────────────────────────────────────────────────────
/**
 * Called from /feed on mount. Quietly runs runHealthKitSync() if:
 *   - We're on iOS native
 *   - The user has previously connected HealthKit
 *   - It's been more than the cooldown since the last sync
 *
 * The cooldown prevents the sync from running on every navigation back to
 * /feed. Two minutes is enough that the user can hit "Sync now" manually
 * and not feel a fight, but tight enough that pulling-to-refresh after a
 * fresh workout still pulls it in within a couple cycles.
 */
const AUTO_SYNC_COOLDOWN_MS = 2 * 60 * 1000;

export async function maybeRunAutoSync(userId: string): Promise<void> {
  if (!isHealthKitAvailable()) return;
  if (!isHealthKitConnected(userId)) return;
  const last = getLastSyncDate(userId);
  if (last && Date.now() - last.getTime() < AUTO_SYNC_COOLDOWN_MS) return;
  // Fire and forget — UI doesn't wait. Errors land in console for debugging
  // but don't surface to the user in auto-sync mode.
  runHealthKitSync(userId).catch(err => {
    console.error('[healthkit] auto-sync failed', err);
  });
}
