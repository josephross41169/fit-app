'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getFitbitAuthURL } from '@/lib/fitbit';
import { supabase } from '@/lib/supabase';

type ConnectedDevice = {
  id: string;
  device_type: string;
  last_synced: string;
};

export function FitbitConnect() {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    checkConnection();
  }, [user]);

  async function checkConnection() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('connected_devices')
        .select('last_synced')
        .eq('user_id', user.id)
        .eq('device_type', 'fitbit')
        .maybeSingle();

      if (data) {
        setConnected(true);
        setLastSynced(data.last_synced);
      }
    } catch (error) {
      console.error('Error checking Fitbit connection:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    if (!user) return;
    
    // Generate state (includes user ID + timestamp)
    const state = `${user.id}_${Date.now()}_${Math.random()}`;
    
    // Get OAuth URL
    const clientId = process.env.NEXT_PUBLIC_FITBIT_CLIENT_ID;
    if (!clientId) {
      console.error('Fitbit Client ID not configured');
      return;
    }

    const redirectUri = `${window.location.origin}/api/fitbit-callback`;
    const authUrl = getFitbitAuthURL(clientId, redirectUri, state);
    
    // Redirect to Fitbit login
    window.location.href = authUrl;
  }

  async function handleDisconnect() {
    if (!user) return;
    try {
      await supabase
        .from('connected_devices')
        .delete()
        .eq('user_id', user.id)
        .eq('device_type', 'fitbit');
      setConnected(false);
      setLastSynced(null);
    } catch (error) {
      console.error('Error disconnecting Fitbit:', error);
    }
  }

  if (loading) return <div style={{ color: '#9CA3AF' }}>Loading...</div>;

  if (connected) {
    return (
      <div style={{
        background: '#1A2A1A',
        border: '1.5px solid #2A3A2A',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📱</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#F0F0F0' }}>Fitbit Connected</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                {lastSynced ? `Last synced: ${new Date(lastSynced).toLocaleString()}` : 'Syncing soon...'}
              </div>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1.5px solid #EF4444',
              background: 'transparent',
              color: '#EF4444',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Disconnect
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
          ✓ Steps, heart rate, sleep, and calories will auto-sync every 4 hours
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      style={{
        width: '100%',
        padding: '14px 16px',
        background: '#1A2A1A',
        border: '1.5px dashed #7C3AED',
        borderRadius: 12,
        color: '#7C3AED',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <span>📱</span>
      Connect Fitbit — Auto-sync steps, heart rate, sleep & more
    </button>
  );
}
