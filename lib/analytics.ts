/**
 * Analytics tracking — Investor-ready data layer
 * Tracks: page views, feature usage, session length, engagement
 */
import { supabase } from './supabase'

let sessionId: string | null = null
let sessionStart: number | null = null
let pageCount = 0

function getSessionId() {
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    sessionStart = Date.now()
  }
  return sessionId
}

export async function trackEvent(
  eventType: string,
  eventData?: Record<string, unknown>,
  userId?: string
) {
  try {
    await supabase.from('analytics_events').insert({
      user_id: userId || null,
      event_type: eventType,
      event_data: eventData || null,
      session_id: getSessionId(),
      platform: typeof window !== 'undefined' ? (window.navigator.userAgent.includes('Mobile') ? 'mobile_web' : 'desktop_web') : 'server',
    })
  } catch {
    // Never let analytics break the app
  }
}

export async function trackPageView(page: string, userId?: string) {
  pageCount++
  await trackEvent('page_view', { page, page_count: pageCount }, userId)
}

export async function trackFeatureUse(feature: string, metadata?: Record<string, unknown>, userId?: string) {
  await trackEvent('feature_use', { feature, ...metadata }, userId)
}

export async function endSession(userId: string) {
  if (!sessionId || !sessionStart) return
  const durationSec = Math.round((Date.now() - sessionStart) / 1000)
  try {
    await supabase.from('analytics_sessions').upsert({
      id: sessionId,
      user_id: userId,
      ended_at: new Date().toISOString(),
      duration_sec: durationSec,
      pages_visited: pageCount,
      platform: typeof window !== 'undefined' ? (window.navigator.userAgent.includes('Mobile') ? 'mobile_web' : 'desktop_web') : 'server',
    })
  } catch {
    // silent
  }
}

// Key events to track (call these from relevant components once auth is wired):
// trackEvent('workout_logged', { type, duration_min, exercises_count })
// trackEvent('food_scanned', { product_name, calories })
// trackEvent('badge_earned', { badge_id })
// trackEvent('post_created', { post_type })
// trackEvent('group_joined', { group_id, category })
// trackEvent('follow', { target_user_id })
// trackEvent('app_opened')
