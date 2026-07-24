"use client";
// components/ToastHost.tsx
// ─────────────────────────────────────────────────────────────────────────────
// App-wide toast notifications, replacing native alert() popups.
//
// The leverage trick: rather than editing ~93 alert() call sites, lib/auth.tsx
// overrides window.alert at mount to route through showToast(). Every existing
// alert in the app instantly becomes a branded toast — and any future alert()
// someone writes gets upgraded for free. New code can also import showToast
// directly for success/error variants.
//
// Design: bottom-anchored above the tab bar, dark card matching the app theme,
// auto-dismiss after 3.5s, tap to dismiss, queue-safe.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";

type Toast = { id: number; message: string; kind: "info" | "success" | "error" };

let nextId = 1;
let listeners: ((t: Toast) => void)[] = [];

export function showToast(message: string, kind: Toast["kind"] = "info") {
  const t: Toast = { id: nextId++, message: String(message), kind };
  listeners.forEach(fn => fn(t));
}

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (t: Toast) => {
      setToasts(prev => [...prev.slice(-2), t]); // cap the stack at 3
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500);
    };
    listeners.push(onToast);
    return () => { listeners = listeners.filter(fn => fn !== onToast); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(76px + env(safe-area-inset-bottom, 0px))", zIndex: 11000, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", padding: "0 16px" }}>
      {toasts.map(t => (
        <button
          key={t.id}
          onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          style={{
            pointerEvents: "auto",
            maxWidth: 420,
            width: "100%",
            textAlign: "left",
            background: "#161D18",
            border: `1px solid ${t.kind === "error" ? "#7F1D1D" : t.kind === "success" ? "#1E5B3F" : "#2A3A2A"}`,
            borderRadius: 12,
            padding: "12px 14px",
            color: "#F0F0F0",
            fontSize: 13.5,
            lineHeight: 1.45,
            boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
            cursor: "pointer",
          }}
        >
          {t.kind === "success" ? "✅ " : t.kind === "error" ? "⚠️ " : ""}{t.message}
        </button>
      ))}
    </div>
  );
}
