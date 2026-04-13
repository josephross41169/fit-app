"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface FoodData {
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  servingSize: string;
  barcode: string;
  image?: string;
}

interface BarcodeScannerProps {
  onResult: (food: FoodData) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"scanning" | "loading" | "error" | "notfound">("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const [scanned, setScanned] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const lookupBarcode = useCallback(async (barcode: string) => {
    if (scanned) return;
    setScanned(true);
    stopCamera();
    setStatus("loading");

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,nutriments,serving_size,image_front_small_url`,
        { signal: AbortSignal.timeout(8000) }
      );
      const data = await res.json();

      if (data.status === 1 && data.product) {
        const p = data.product;
        const n = p.nutriments || {};

        // Prefer per-serving values, fall back to per-100g
        const get = (key: string) => {
          const serving = n[`${key}_serving`];
          const per100 = n[`${key}_100g`];
          return Math.round((serving !== undefined ? serving : per100) || 0);
        };

        onResult({
          name: p.product_name || "Unknown Product",
          brand: p.brands || "",
          calories: get("energy-kcal"),
          protein: get("proteins"),
          carbs: get("carbohydrates"),
          fat: get("fat"),
          fiber: get("fiber"),
          sugar: get("sugars"),
          sodium: get("sodium"),
          servingSize: p.serving_size || "100g",
          barcode,
          image: p.image_front_small_url,
        });
      } else {
        setStatus("notfound");
        setScanned(false);
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error � check your connection.");
      setScanned(false);
    }
  }, [scanned, stopCamera, onResult]);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Dynamic import ZXing after camera is ready
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();

        intervalRef.current = setInterval(async () => {
          if (!active || scanned || !videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video.readyState < 2) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(video, 0, 0);
          try {
            const result = await reader.decodeFromCanvas(canvas);
            if (result) lookupBarcode(result.getText());
          } catch {
            // no barcode yet � keep trying
          }
        }, 300);
      } catch (err: unknown) {
        if (active) {
          setStatus("error");
          setErrorMsg(
            err instanceof Error && err.name === "NotAllowedError"
              ? "Camera permission denied. Please allow camera access and try again."
              : "Could not access camera."
          );
        }
      }
    }

    startCamera();
    return () => {
      active = false;
      stopCamera();
    };
  }, [lookupBarcode, scanned, stopCamera]);

  const retry = () => {
    setStatus("scanning");
    setScanned(false);
    setErrorMsg("");
    // Re-mount by reloading � simplest approach
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-black/80">
        <button onClick={() => { stopCamera(); onClose(); }} className="text-white p-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-white font-bold text-lg">Scan Barcode</span>
        <div className="w-10" />
      </div>

      {/* Camera */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewfinder overlay */}
        {status === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-72 h-48">
              {/* Dimmed outer */}
              <div className="absolute -inset-[9999px] bg-black/50" />
              {/* Clear center */}
              <div className="absolute inset-0 rounded-xl overflow-hidden">
                {/* Animated scan line */}
                <div
                  className="absolute left-0 right-0 h-0.5 opacity-80"
                  style={{
                    background: "linear-gradient(90deg, transparent, #7C3AED, #A78BFA, #7C3AED, transparent)",
                    animation: "scanLine 2s ease-in-out infinite",
                    top: "0%",
                  }}
                />
              </div>
              {/* Corner brackets */}
              {[
                "top-0 left-0 border-t-2 border-l-2 rounded-tl-xl",
                "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl",
                "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl",
                "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl",
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-purple-400 ${cls}`} />
              ))}
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="bg-white rounded-3xl p-8 mx-6 text-center shadow-2xl">
              <div
                className="w-12 h-12 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin mx-auto mb-4"
              />
              <p className="font-bold text-gray-800 text-lg">Looking up product�</p>
              <p className="text-gray-500 text-sm mt-1">Checking Open Food Facts database</p>
            </div>
          </div>
        )}

        {/* Not found overlay */}
        {status === "notfound" && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="bg-white rounded-3xl p-8 mx-6 text-center shadow-2xl">
              <div className="text-4xl mb-3">??</div>
              <p className="font-bold text-gray-800 text-lg">Product Not Found</p>
              <p className="text-gray-500 text-sm mt-1 mb-5">
                This item isn&apos;t in the database yet.
              </p>
              <button
                onClick={retry}
                className="w-full py-3 rounded-2xl font-semibold text-white"
                style={{ background: "#7C3AED" }}
              >
                Scan Again
              </button>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {status === "error" && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="bg-white rounded-3xl p-8 mx-6 text-center shadow-2xl">
              <div className="text-4xl mb-3">??</div>
              <p className="font-bold text-gray-800 text-lg">Camera Error</p>
              <p className="text-gray-500 text-sm mt-1 mb-5">{errorMsg}</p>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="w-full py-3 rounded-2xl font-semibold text-white"
                style={{ background: "#7C3AED" }}
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {status === "scanning" && (
        <div className="bg-black px-6 py-5 text-center">
          <p className="text-gray-400 text-sm">Aim at the barcode on any food package</p>
          <p className="text-gray-600 text-xs mt-1">Powered by Open Food Facts � 3M+ products</p>
        </div>
      )}

      <style jsx global>{`
        @keyframes scanLine {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}


