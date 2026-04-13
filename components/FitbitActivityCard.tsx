'use client';

import { useState } from 'react';

type FitbitData = {
  steps?: number;
  distance?: number;
  calories_burned?: number;
  heart_rate?: number;
  sleep_minutes?: number;
  sleep_efficiency?: number;
  synced_at?: string;
};

export function FitbitActivityCard({ data }: { data: FitbitData }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!data.steps && !data.sleep_minutes) {
    return null; // No data to display
  }

  const C = {
    blue: '#7C3AED',
    text: '#F0F0F0',
    sub: '#9CA3AF',
    white: '#1A1A1A',
    greenLight: '#1A2A1A',
    greenMid: '#2A3A2A',
  };

  return (
    <div style={{
      background: C.white,
      borderRadius: 16,
      padding: 16,
      border: `1.5px solid ${C.greenMid}`,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: C.greenLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            border: `1.5px solid ${C.greenMid}`,
          }}>
            📱
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Fitbit Sync</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
              {data.synced_at ? new Date(data.synced_at).toLocaleTimeString() : 'Just now'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: `1.5px solid ${C.greenMid}`,
            background: 'transparent',
            color: C.sub,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showAdvanced ? '✕ Hide' : '📊 Advanced'}
        </button>
      </div>

      {/* Main Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        marginBottom: showAdvanced ? 16 : 0,
      }}>
        {/* Steps */}
        {data.steps !== undefined && (
          <div style={{
            background: C.greenLight,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${C.greenMid}`,
          }}>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
              Steps
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>
              {data.steps.toLocaleString()}
            </div>
          </div>
        )}

        {/* Calories */}
        {data.calories_burned !== undefined && (
          <div style={{
            background: C.greenLight,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${C.greenMid}`,
          }}>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
              Calories Burned
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#F5A623' }}>
              {data.calories_burned}
            </div>
          </div>
        )}

        {/* Heart Rate */}
        {data.heart_rate !== undefined && (
          <div style={{
            background: C.greenLight,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${C.greenMid}`,
          }}>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
              Resting Heart Rate
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#EF4444' }}>
              {data.heart_rate} bpm
            </div>
          </div>
        )}

        {/* Sleep */}
        {data.sleep_minutes !== undefined && data.sleep_minutes > 0 && (
          <div style={{
            background: C.greenLight,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${C.greenMid}`,
          }}>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
              Sleep
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#7C3AED' }}>
              {Math.round(data.sleep_minutes / 60)}h {data.sleep_minutes % 60}m
            </div>
          </div>
        )}
      </div>

      {/* Advanced Data */}
      {showAdvanced && (
        <div style={{
          background: C.greenLight,
          padding: 12,
          borderRadius: 12,
          border: `1px solid ${C.greenMid}`,
          marginTop: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            📊 Advanced Data
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.distance !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.sub }}>
                <span>Distance:</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{data.distance.toFixed(2)} miles</span>
              </div>
            )}
            {data.sleep_efficiency !== undefined && data.sleep_efficiency > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.sub }}>
                <span>Sleep Efficiency:</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{data.sleep_efficiency}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

