"use client";
import { useRef, useEffect, useState } from "react";

const PURPLE = "#7C3AED";
const PURPLE_DARK = "#4C1D95";
const GOLD = "#F5A623";
const BG = "#0D0D0D";
const CARD_BG = "#111118";

export type ShareCardData = {
  type: "workout" | "nutrition" | "pr" | "wellness";
  username: string;
  displayName: string;
  tier?: string; // "default" | "active" | "grinder" | "elite" | "untouchable"
  // workout fields
  workoutType?: string;
  duration?: string;
  totalVolume?: number;
  totalSets?: number;
  calories?: number;
  exercises?: { name: string; sets: number; reps: number; weight: string }[];
  prExercise?: string;
  prWeight?: number;
  prReps?: number;
  // nutrition fields
  totalCalories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  // pr fields
  prBadge?: boolean;
};

const TIER_COLORS: Record<string, { label: string; color: string; emoji: string }> = {
  default:     { label: "Default",     color: "#9CA3AF", emoji: "🩶" },
  active:      { label: "Active",      color: "#7C3AED", emoji: "🟣" },
  grinder:     { label: "Grinder",     color: "#F5A623", emoji: "🔥" },
  elite:       { label: "Elite",       color: "#06B6D4", emoji: "⚡" },
  untouchable: { label: "Untouchable", color: "#EC4899", emoji: "💀" },
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderCanvas(canvas: HTMLCanvasElement, data: ShareCardData) {
  const W = 1080;
  const H = 1080;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ── Purple gradient top bar ─────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, W, 220);
  grad.addColorStop(0, PURPLE_DARK);
  grad.addColorStop(1, PURPLE);
  ctx.fillStyle = grad;
  drawRoundRect(ctx, 0, 0, W, 220, 0);
  ctx.fill();

  // ── FIT brand ──────────────────────────────────────────────────────────────
  ctx.font = "bold 64px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("FIT ⚡", 60, 100);

  // ── Tier badge ────────────────────────────────────────────────────────────
  const tier = data.tier && TIER_COLORS[data.tier] ? TIER_COLORS[data.tier] : TIER_COLORS.default;
  const tierText = `${tier.emoji} ${tier.label}`;
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  const tierW = ctx.measureText(tierText).width + 32;
  const tierX = W - 60 - tierW;
  ctx.fillStyle = tier.color + "33";
  drawRoundRect(ctx, tierX, 52, tierW, 44, 12);
  ctx.fill();
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = tier.color;
  ctx.fillText(tierText, tierX + 16, 83);

  // ── Username ───────────────────────────────────────────────────────────────
  ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(data.displayName, 60, 170);
  ctx.font = "28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(`@${data.username}`, 60, 208);

  // ── Content area ──────────────────────────────────────────────────────────
  let y = 268;
  const padX = 60;
  const innerW = W - padX * 2;

  if (data.type === "workout" || data.type === "pr") {
    // Big headline
    const headline = data.prExercise
      ? `🏆 New PR: ${data.prExercise}`
      : `🏋️ ${data.workoutType || "Workout"}`;
    ctx.font = "bold 52px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = data.prExercise ? GOLD : "#ffffff";
    ctx.fillText(headline, padX, y);
    y += 72;

    if (data.prExercise && data.prWeight && data.prReps) {
      // PR details
      ctx.font = "bold 80px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = GOLD;
      ctx.fillText(`${data.prWeight} lbs × ${data.prReps}`, padX, y);
      y += 100;
      const vol = data.prWeight * data.prReps;
      ctx.font = "32px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#9CA3AF";
      ctx.fillText(`Volume: ${vol.toLocaleString()} lbs`, padX, y);
      y += 60;
    } else {
      // Stat chips row
      const stats = [
        data.duration ? { label: "Duration", value: data.duration, icon: "⏱" } : null,
        data.totalVolume ? { label: "Volume", value: `${data.totalVolume.toLocaleString()} lbs`, icon: "🏋️" } : null,
        data.totalSets ? { label: "Sets", value: String(data.totalSets), icon: "🔁" } : null,
        data.calories ? { label: "Calories", value: `${data.calories} cal`, icon: "🔥" } : null,
      ].filter(Boolean) as { label: string; value: string; icon: string }[];

      const chipW = (innerW - (stats.length - 1) * 20) / Math.max(stats.length, 1);
      stats.forEach((stat, i) => {
        const cx = padX + i * (chipW + 20);
        ctx.fillStyle = "#1A1228";
        drawRoundRect(ctx, cx, y, chipW, 110, 16);
        ctx.fill();
        ctx.strokeStyle = "#2D1F52";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = "36px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(stat.icon, cx + chipW / 2, y + 46);
        ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
        ctx.fillText(stat.value, cx + chipW / 2, y + 78);
        ctx.font = "22px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#6B7280";
        ctx.fillText(stat.label, cx + chipW / 2, y + 102);
        ctx.textAlign = "left";
      });
      y += 140;

      // Exercise list
      if (data.exercises && data.exercises.length > 0) {
        ctx.font = "bold 30px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#9CA3AF";
        ctx.fillText("EXERCISES", padX, y);
        y += 44;

        const maxExercises = Math.min(data.exercises.length, 5);
        for (let i = 0; i < maxExercises; i++) {
          const ex = data.exercises[i];
          // Row bg
          ctx.fillStyle = i % 2 === 0 ? "#111118" : "#0F0F16";
          drawRoundRect(ctx, padX, y, innerW, 60, 10);
          ctx.fill();

          ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#F0F0F0";
          ctx.fillText(ex.name, padX + 20, y + 38);

          const detail = `${ex.sets}×${ex.reps} @ ${ex.weight}`;
          ctx.font = "24px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = PURPLE;
          ctx.textAlign = "right";
          ctx.fillText(detail, padX + innerW - 20, y + 38);
          ctx.textAlign = "left";
          y += 68;
        }
        if (data.exercises.length > 5) {
          ctx.font = "22px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#6B7280";
          ctx.fillText(`+${data.exercises.length - 5} more exercises`, padX, y + 10);
          y += 40;
        }
      }
    }
  } else if (data.type === "nutrition") {
    ctx.font = "bold 52px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#4ADE80";
    ctx.fillText("🥗 Nutrition Log", padX, y);
    y += 80;

    const macros = [
      { label: "Calories", value: `${data.totalCalories || 0}`, unit: "kcal", color: "#F5A623" },
      { label: "Protein",  value: `${data.protein || 0}g`,  unit: "",       color: "#7C3AED" },
      { label: "Carbs",    value: `${data.carbs || 0}g`,    unit: "",       color: "#06B6D4" },
      { label: "Fat",      value: `${data.fat || 0}g`,      unit: "",       color: "#F87171" },
    ];
    const chipW2 = (innerW - 3 * 20) / 4;
    macros.forEach((m, i) => {
      const cx = padX + i * (chipW2 + 20);
      ctx.fillStyle = "#1A1228";
      drawRoundRect(ctx, cx, y, chipW2, 120, 16);
      ctx.fill();
      ctx.strokeStyle = m.color + "55";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = m.color;
      ctx.fillText(m.value, cx + chipW2 / 2, y + 60);
      ctx.font = "22px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#9CA3AF";
      ctx.fillText(m.label, cx + chipW2 / 2, y + 96);
      ctx.textAlign = "left";
    });
    y += 156;
  }

  // ── Bottom watermark ───────────────────────────────────────────────────────
  const bmY = H - 80;
  ctx.fillStyle = "#1A1228";
  ctx.fillRect(0, bmY - 20, W, 100);

  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = PURPLE;
  ctx.fillText("fit-app-ecru.vercel.app", padX, bmY + 28);

  ctx.font = "26px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#6B7280";
  ctx.textAlign = "right";
  const now = new Date();
  ctx.fillText(`${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, W - padX, bmY + 28);
  ctx.textAlign = "left";

  // ── Subtle grid overlay ────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(124,58,237,0.04)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 60) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
  }
  for (let gy = 220; gy < bmY - 20; gy += 60) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }
}

// ── Modal Component ─────────────────────────────────────────────────────────
export default function ShareCard({ data, onClose }: { data: ShareCardData; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) renderCanvas(canvasRef.current, data);
  }, [data]);

  function download() {
    if (!canvasRef.current) return;
    setDownloading(true);
    const link = document.createElement("a");
    link.download = `fit-${data.type}-${data.username}-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    setTimeout(() => setDownloading(false), 800);
  }

  async function copyToClipboard() {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {
      // Fallback: just download
      download();
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#111118",
        borderRadius: 24,
        border: "1px solid #2D1F52",
        padding: 24,
        maxWidth: 540,
        width: "100%",
        boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: "#F0F0F0", fontSize: 20, fontWeight: 700 }}>📤 Share Your Card</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#6B7280", fontSize: 22, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Canvas preview — scaled to fit */}
        <div style={{
          width: "100%", aspectRatio: "1", borderRadius: 16, overflow: "hidden",
          border: "1px solid #2D1F52", marginBottom: 20,
          background: "#0D0D0D",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </div>

        <p style={{ margin: "0 0 16px", color: "#6B7280", fontSize: 13, textAlign: "center" }}>
          1080×1080 · Perfect for Instagram, Twitter &amp; TikTok
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={copyToClipboard}
            style={{
              flex: 1, padding: "14px 0", borderRadius: 14, border: "1.5px solid #2D1F52",
              background: "#1A1228", color: "#F0F0F0", fontSize: 15, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copied ? "✅ Copied!" : "📋 Copy Image"}
          </button>
          <button
            onClick={download}
            style={{
              flex: 1, padding: "14px 0", borderRadius: 14, border: "none",
              background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
              color: "#ffffff", fontSize: 15, fontWeight: 700,
              cursor: "pointer",
              opacity: downloading ? 0.7 : 1,
            }}
          >
            {downloading ? "Saving..." : "⬇️ Download PNG"}
          </button>
        </div>
      </div>
    </div>
  );
}
