import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFitbitActivityToday, getFitbitHeartToday, getFitbitSleepToday } from '@/lib/fitbit';

export const dynamic = 'force-dynamic';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Called by cron job every 4 hours to sync Fitbit data
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all users with connected Fitbit devices
    const { data: devices, error: devicesError } = await supabase
      .from('connected_devices')
      .select('user_id, access_token')
      .eq('device_type', 'fitbit');

    if (devicesError || !devices) {
      console.error('Error fetching connected devices:', devicesError);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const results = [];

    for (const device of devices) {
      try {
        // Fetch activity, heart, and sleep data
        const [activity, heart, sleep] = await Promise.all([
          getFitbitActivityToday(device.access_token),
          getFitbitHeartToday(device.access_token),
          getFitbitSleepToday(device.access_token),
        ]);

        if (!activity) continue;

        // Extract data
        const steps = activity.summary.steps || 0;
        const distance = activity.summary.distance || 0;
        const caloriesBurned = activity.summary.caloriesBurned || 0;
        const avgHeartRate = heart?.activities?.[0]?.value?.resting || null;
        const sleepData = sleep?.sleep?.[0];
        const minutesAsleep = sleepData?.minutesAsleep || 0;
        const sleepEfficiency = sleepData?.efficiency || 0;

        // Build activity data
        const activityData = {
          device_type: 'fitbit',
          steps,
          distance: Math.round(distance * 100) / 100,
          calories_burned: caloriesBurned,
          heart_rate: avgHeartRate,
          sleep_minutes: minutesAsleep,
          sleep_efficiency: sleepEfficiency,
          synced_at: new Date().toISOString(),
        };

        // Check if we already logged today
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('activity_logs')
          .select('id')
          .eq('user_id', device.user_id)
          .eq('log_type', 'auto_fitbit')
          .gte('created_at', `${today}T00:00:00`)
          .maybeSingle();

        let logId: string;

        if (existing) {
          // Update existing log
          const { data: updated } = await supabase
            .from('activity_logs')
            .update(activityData)
            .eq('id', existing.id)
            .select('id')
            .single();
          logId = updated?.id || existing.id;
        } else {
          // Create new log
          const { data: created, error: createError } = await supabase
            .from('activity_logs')
            .insert({
              user_id: device.user_id,
              log_type: 'auto_fitbit',
              is_public: true,
              logged_at: new Date().toISOString(),
              ...activityData,
            })
            .select('id')
            .single();

          if (createError || !created) {
            console.error('Error creating activity log:', createError);
            continue;
          }

          logId = created.id;
        }

        // Update last_synced timestamp
        await supabase
          .from('connected_devices')
          .update({ last_synced: new Date().toISOString() })
          .eq('user_id', device.user_id)
          .eq('device_type', 'fitbit');

        results.push({ user_id: device.user_id, success: true, logId });
      } catch (error) {
        console.error(`Error syncing Fitbit for user ${device.user_id}:`, error);
        results.push({ user_id: device.user_id, success: false, error: String(error) });
      }
    }

    return NextResponse.json({ synced: results.length, results });
  } catch (error: any) {
    console.error('Fitbit sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
