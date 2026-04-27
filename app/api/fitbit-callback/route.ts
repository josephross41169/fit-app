import { NextRequest, NextResponse } from 'next/server';
import { exchangeFitbitCode } from '@/lib/fitbit';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key-for-build'
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'https://fit-app-ecru.vercel.app'}/post?fitbit_error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'https://fit-app-ecru.vercel.app'}/post?fitbit_error=missing_code`
      );
    }

    // Check if Fitbit is configured
    if (!process.env.FITBIT_CLIENT_ID || !process.env.FITBIT_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'https://fit-app-ecru.vercel.app'}/post?fitbit_error=not_configured`
      );
    }

    // Exchange code for token
    const token = await exchangeFitbitCode(
      code,
      process.env.FITBIT_CLIENT_ID,
      process.env.FITBIT_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://fit-app-ecru.vercel.app'}/api/fitbit-callback`
    );

    // Get user ID from state (format: userId_timestamp_random)
    const userId = state.split('_')[0];

    // Store token in Supabase
    const { error: dbError } = await supabase
      .from('connected_devices')
      .upsert({
        user_id: userId,
        device_type: 'fitbit',
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        last_synced: new Date().toISOString(),
      }, {
        onConflict: 'user_id,device_type'
      });

    if (dbError) {
      console.error('DB error storing Fitbit token:', dbError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'https://fit-app-ecru.vercel.app'}/post?fitbit_error=db_error`
      );
    }

    // Redirect back to post page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://fit-app-ecru.vercel.app'}/post?fitbit_connected=true`
    );
  } catch (error: any) {
    console.error('Fitbit callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://fit-app-ecru.vercel.app'}/post?fitbit_error=callback_error`
    );
  }
}
