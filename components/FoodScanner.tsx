'use client';

import { useRef, useState } from 'react';

export type ScannedFood = {
  foodName: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: 'high' | 'medium' | 'low';
};

type FoodScannerProps = {
  onFoodScanned: (food: ScannedFood) => void;
};

export function FoodScanner({ onFoodScanned }: FoodScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScannedFood | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      setError(null);
      setLoading(true);

      try {
        // Convert data URL to base64
        const base64 = dataUrl.split(',')[1];

        // Call our API endpoint
        const response = await fetch('/api/scan-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const food: ScannedFood = await response.json();
        setResult(food);
        onFoodScanned(food);
      } catch (err: any) {
        setError(err.message || 'Failed to scan food');
        setPreview(null);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsDataURL(file);
    event.target.value = ''; // Reset input
  };

  return (
    <div style={{ 
      padding: '16px', 
      background: '#1A2A1A', 
      border: '1.5px solid #2A3A2A', 
      borderRadius: 10,
      marginBottom: 16 
    }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ 
          display: 'inline-block',
          padding: '8px 16px',
          background: '#7C3AED',
          color: '#fff',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          border: 'none',
        }}>
          📸 Scan Food
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {preview && (
        <div style={{ marginBottom: 16 }}>
          <img 
            src={preview} 
            alt="food preview" 
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              maxHeight: 200,
              borderRadius: 8,
              display: 'block'
            }} 
          />
        </div>
      )}

      {loading && (
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>
          🔍 Analyzing food... (using OpenAI Vision)
        </div>
      )}

      {error && (
        <div style={{ color: '#EF4444', fontSize: 14, marginBottom: 12 }}>
          ❌ {error}
        </div>
      )}

      {result && !loading && (
        <div style={{ 
          background: '#0F1117',
          padding: 12,
          borderRadius: 8,
          fontSize: 13,
          color: '#F0F0F0'
        }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{result.foodName}</strong> ({result.servingSize})
          </div>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
            fontSize: 12,
            color: '#9CA3AF'
          }}>
            <div>🔥 {result.calories} cal</div>
            <div>💪 {result.protein}g protein</div>
            <div>🌾 {result.carbs}g carbs</div>
            <div>🧈 {result.fat}g fat</div>
            <div>📊 Fiber: {result.fiber}g</div>
            <div>✔️ {result.confidence} confidence</div>
          </div>
          <button
            onClick={() => {
              onFoodScanned(result);
              setResult(null);
              setPreview(null);
            }}
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: '#7C3AED',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            ✓ Add to Meal
          </button>
        </div>
      )}
    </div>
  );
}

