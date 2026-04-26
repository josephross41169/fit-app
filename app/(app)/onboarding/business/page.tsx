"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { compressImage } from "@/lib/compressImage";
import { isBusinessAccount } from "@/lib/businessTypes";

const C = {
  purple: "#7C3AED",
  purpleDark: "#6D28D9",
  purpleLight: "#F3F0FF",
  purpleMid: "#DDD6FE",
  gold: "#F5A623",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  bg: "#0D0D0D",
  card: "#111111",
  border: "#1A1228",
};

const FITNESS_GOALS = [
  { id: "lose_fat", emoji: "🔥", label: "Lose Fat", desc: "Cut body fat and get leaner" },
  { id: "build_muscle", emoji: "💪", label: "Build Muscle", desc: "Gain strength and size" },
  { id: "maintain", emoji: "⚖️", label: "Maintain", desc: "Stay consistent and healthy" },
  { id: "improve_cardio", emoji: "🏃", label: "Cardio / Endurance", desc: "Run faster, go longer" },
  { id: "sports_performance", emoji: "⚡", label: "Athletic Performance", desc: "Train for sport" },
  { id: "wellness", emoji: "🧘", label: "Wellness & Recovery", desc: "Reduce stress, sleep better" },
];

const ACTIVITY_LEVELS = [
  { id: "sedentary", emoji: "🪑", label: "Sedentary", desc: "Little to no exercise" },
  { id: "light", emoji: "🚶", label: "Lightly Active", desc: "1–3 days/week" },
  { id: "moderate", emoji: "🏋️", label: "Moderately Active", desc: "3–5 days/week" },
  { id: "very", emoji: "⚡", label: "Very Active", desc: "6–7 days/week" },
  { id: "athlete", emoji: "🏆", label: "Athlete", desc: "2× a day or competitive" },
];

const FOCUS_AREAS = [
  { id: "chest", emoji: "💪", label: "Chest" },
  { id: "back", emoji: "🦾", label: "Back" },
  { id: "shoulders", emoji: "🏋️", label: "Shoulders" },
  { id: "arms", emoji: "💪", label: "Arms" },
  { id: "legs", emoji: "🦵", label: "Legs" },
  { id: "core", emoji: "🎯", label: "Core" },
  { id: "cardio", emoji: "🏃", label: "Cardio" },
  { id: "full_body", emoji: "⚡", label: "Full Body" },
];

const EQUIPMENT = [
  { id: "full_gym", emoji: "🏋️", label: "Full Gym" },
  { id: "home_gym", emoji: "🏠", label: "Home Gym" },
  { id: "dumbbells", emoji: "💪", label: "Dumbbells Only" },
  { id: "bodyweight", emoji: "🤸", label: "Bodyweight" },
  { id: "resistance_bands", emoji: "🔄", label: "Resistance Bands" },
  { id: "cardio_machines", emoji: "🚴", label: "Cardio Machines" },
];

type Step = 1 | 2 | 3 | 4 | 5;

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i < step ? C.purple : "#2A2A2A",
            transition: "background 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

function SelectChip({
  selected, onClick, emoji, label, desc,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  desc?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", borderRadius: 16,
        border: `2px solid ${selected ? C.purple : "#2A2A2A"}`,
        background: selected ? "rgba(124,58,237,0.12)" : C.card,
        cursor: "pointer", textAlign: "left", width: "100%",
        transition: "all 0.15s",
        boxShadow: selected ? `0 0 0 1px ${C.purple}40` : "none",
      }}
    >
      <span style={{ fontSize: 26, flexShrink: 0 }}>{emoji}</span>
      <div>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>{desc}</div>}
      </div>
      {selected && (
        <div style={{
          marginLeft: "auto", width: 22, height: 22, borderRadius: "50%",
          background: C.purple, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, fontSize: 12, color: "#fff", fontWeight: 900,
        }}>✓</div>
      )}
    </button>
  );
}

function ChipGrid({
  items, selected, onToggle, cols = 2,
}: {
  items: { id: string; emoji: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  cols?: number;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 10,
    }}>
      {items.map(item => {
        const isSelected = selected.includes(item.id);
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            style={{
              padding: "12px 10px", borderRadius: 14,
              border: `2px solid ${isSelected ? C.purple : "#2A2A2A"}`,
              background: isSelected ? "rgba(124,58,237,0.12)" : C.card,
              cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 6,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 22 }}>{item.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "#A78BFA" : C.sub }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Business accounts get a completely different onboarding flow — no goals,
  // no macros, no tier/rivals talk. They go to /onboarding/business instead.
  useEffect(() => {
    if (!user) return;
    if (isBusinessAccount(user.profile)) {
      router.replace("/onboarding/business");
    }
  }, [user, router]);

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Profile basics
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Step 2 — Goal
  const [goal, setGoal] = useState("");
  const [activityLevel, setActivityLevel] = useState("");

  // Step 3 — Focus areas + equipment
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);

  // Step 4 — Macro goals
  const [calories, setCalories] = useState("2500");
  const [protein, setProtein] = useState("180");
  const [carbs, setCarbs] = useState("250");
  const [fat, setFat] = useState("70");
  const [waterOz, setWaterOz] = useState("100");

  function toggleFocus(id: string) {
    setFocusAreas(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  }
  function toggleEquipment(id: string) {
    setEquipment(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  }

  // Auto-suggest macros based on goal
  function suggestMacros() {
    if (goal === "lose_fat") { setCalories("2000"); setProtein("200"); setCarbs("180"); setFat("60"); }
    else if (goal === "build_muscle") { setCalories("3000"); setProtein("220"); setCarbs("300"); setFat("80"); }
    else if (goal === "improve_cardio") { setCalories("2400"); setProtein("160"); setCarbs("280"); setFat("65"); }
    else { setCalories("2500"); setProtein("180"); setCarbs("250"); setFat("70"); }
  }

  function loadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => setAvatarPreview(ev.target!.result as string);
    r.readAsDataURL(f);
    e.target.value = "";
  }

  async function handleFinish() {
    if (!user) return;
    setSaving(true);

    try {
      let avatarUrl: string | null = null;
      if (avatarPreview) {
        const compressed = await compressImage(avatarPreview, 800, 0.85);
        avatarUrl = await uploadPhoto(compressed, "avatars", `${user.id}/avatar.jpg`);
      }

      const updateData: Record<string, any> = {
        onboarded: true,
        nutrition_goals: {
          calories: parseFloat(calories) || 2500,
          protein: parseFloat(protein) || 180,
          carbs: parseFloat(carbs) || 250,
          fat: parseFloat(fat) || 70,
          water_oz: parseFloat(waterOz) || 100,
        },
        fitness_goal: goal || null,
        activity_level: activityLevel || null,
        focus_areas: focusAreas.length > 0 ? focusAreas : null,
        equipment_access: equipment.length > 0 ? equipment : null,
      };
      if (displayName.trim()) updateData.full_name = displayName.trim();
      if (bio.trim()) updateData.bio = bio.trim();
      if (avatarUrl) updateData.avatar_url = avatarUrl;

      await supabase.from("users").update(updateData).eq("id", user.id);
    } catch {}

    setSaving(false);
    router.push("/feed");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 14,
    border: "1.5px solid #2A2A2A",
    background: C.card,
    fontSize: 15,
    color: C.text,
    outline: "none",
    boxSizing: "border-box",
  };

  const canProceed: Record<Step, boolean> = {
    1: true, // optional
    2: !!goal && !!activityLevel,
    3: focusAreas.length > 0 && equipment.length > 0,
    4: true, // pre-filled
    5: true,
  };

  const TOTAL_STEPS = 5;

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center",
      padding: "32px 20px 100px",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🦾</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 1 }}>
            Step {step} of {TOTAL_STEPS}
          </div>
        </div>

        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* ─── STEP 1: Profile Photo + Name ─────────────────────── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>Let's set up your profile</h2>
              <p style={{ fontSize: 15, color: C.sub, margin: 0 }}>You can always change this later.</p>
            </div>

            {/* Avatar upload */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <label style={{ cursor: "pointer" }}>
                <div style={{
                  width: 100, height: 100, borderRadius: "50%",
                  background: avatarPreview ? "transparent" : "linear-gradient(135deg, #7C3AED, #A78BFA)",
                  border: "3px solid #7C3AED",
                  overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 36,
                }}>
                  {avatarPreview
                    ? <img src={avatarPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                    : "📷"
                  }
                </div>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={loadAvatar} />
              </label>
              <div style={{ fontSize: 13, color: C.sub }}>Tap to add profile photo</div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Display Name</label>
              <input style={inputStyle} placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Bio (optional)</label>
              <textarea
                rows={3}
                style={{ ...inputStyle, resize: "none" }}
                placeholder="What drives you? What are you working toward?"
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ─── STEP 2: Fitness Goal + Activity Level ─────────────── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>What's your main goal?</h2>
              <p style={{ fontSize: 15, color: C.sub, margin: 0 }}>We'll personalize your experience.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FITNESS_GOALS.map(g => (
                <SelectChip
                  key={g.id}
                  selected={goal === g.id}
                  onClick={() => setGoal(g.id)}
                  emoji={g.emoji}
                  label={g.label}
                  desc={g.desc}
                />
              ))}
            </div>

            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Activity level</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ACTIVITY_LEVELS.map(a => (
                  <SelectChip
                    key={a.id}
                    selected={activityLevel === a.id}
                    onClick={() => setActivityLevel(a.id)}
                    emoji={a.emoji}
                    label={a.label}
                    desc={a.desc}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Focus Areas + Equipment ───────────────────── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>What do you train?</h2>
              <p style={{ fontSize: 15, color: C.sub, margin: 0 }}>Pick all that apply.</p>
            </div>

            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Focus areas</h3>
              <ChipGrid items={FOCUS_AREAS} selected={focusAreas} onToggle={toggleFocus} cols={4} />
            </div>

            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Equipment access</h3>
              <ChipGrid items={EQUIPMENT} selected={equipment} onToggle={toggleEquipment} cols={3} />
            </div>
          </div>
        )}

        {/* ─── STEP 4: Macro Goals ────────────────────────────────── */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>Set your daily targets</h2>
              <p style={{ fontSize: 15, color: C.sub, margin: 0 }}>Used for your nutrition progress bars.</p>
            </div>

            {goal && (
              <button
                onClick={suggestMacros}
                style={{
                  padding: "12px 16px", borderRadius: 14,
                  border: "2px solid #7C3AED", background: "rgba(124,58,237,0.1)",
                  color: "#A78BFA", fontWeight: 800, fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                ✨ Auto-suggest macros for my goal
              </button>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Daily Calories", unit: "kcal", val: calories, set: setCalories },
                { label: "Protein", unit: "g/day", val: protein, set: setProtein },
                { label: "Carbs", unit: "g/day", val: carbs, set: setCarbs },
                { label: "Fat", unit: "g/day", val: fat, set: setFat },
                { label: "Water", unit: "oz/day", val: waterOz, set: setWaterOz },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {f.label} <span style={{ color: "#6B7280" }}>({f.unit})</span>
                  </label>
                  <input
                    style={inputStyle}
                    type="text"
                    inputMode="numeric"
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: "14px 16px", border: "1.5px solid #2A2A2A" }}>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                💡 These power your daily nutrition progress bars on the Log screen. You can update them anytime under Nutrition → Edit Goals.
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 5: Welcome / Ready ────────────────────────────── */}
        {step === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: 72 }}>🏆</div>
            <div>
              <h2 style={{ fontSize: 32, fontWeight: 900, color: C.text, margin: "0 0 10px" }}>You're all set!</h2>
              <p style={{ fontSize: 16, color: C.sub, margin: 0, lineHeight: 1.6 }}>
                Start logging your first workout, track your nutrition, and climb the ranks. The grind starts now.
              </p>
            </div>

            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { emoji: "🏋️", text: "Log workouts & track PRs" },
                { emoji: "🥗", text: "Track nutrition with macro goals" },
                { emoji: "⚔️", text: "Get matched with rivals" },
                { emoji: "🏆", text: "Earn badges & climb tier ranks" },
                { emoji: "📊", text: "See your progress in Stats" },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: C.card, borderRadius: 14, padding: "12px 16px",
                    border: "1.5px solid #2A2A2A", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{item.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ marginTop: 32, display: "flex", gap: 12 }}>
          {step > 1 && (
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              style={{
                flex: 1, padding: "15px 0", borderRadius: 16,
                border: "1.5px solid #2A2A2A", background: "transparent",
                color: C.sub, fontWeight: 800, fontSize: 15, cursor: "pointer",
              }}
            >
              ← Back
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(s => (s + 1) as Step)}
              disabled={!canProceed[step]}
              style={{
                flex: 2, padding: "15px 0", borderRadius: 16,
                border: "none",
                background: canProceed[step]
                  ? "linear-gradient(135deg, #7C3AED, #A78BFA)"
                  : "#2A2A2A",
                color: canProceed[step] ? "#fff" : "#6B7280",
                fontWeight: 900, fontSize: 16, cursor: canProceed[step] ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
            >
              {step === 1 ? "Let's Go →" : "Next →"}
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              style={{
                flex: 2, padding: "15px 0", borderRadius: 16,
                border: "none",
                background: saving ? "#2A2A2A" : "linear-gradient(135deg, #7C3AED, #A78BFA)",
                color: saving ? "#6B7280" : "#fff",
                fontWeight: 900, fontSize: 16,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Setting up..." : "🚀 Start Your Journey"}
            </button>
          )}
        </div>

        {/* Skip link (step 1 only) */}
        {step === 1 && (
          <button
            onClick={() => setStep(2)}
            style={{ display: "block", width: "100%", marginTop: 14, background: "none", border: "none", color: C.sub, fontSize: 13, cursor: "pointer" }}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
