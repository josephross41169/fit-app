"use client";
// Test page for ActivityShareButton. Visit /share-test in the browser to
// verify the share button works end-to-end with a hardcoded sample card
// before wiring it into the real profile page.
//
// If this page renders fine and the 📸 button downloads a PNG, we know
// the share component is solid and we can safely wire it into profile.

import ActivityShareButton from "@/components/ActivityShareButton";

export default function ShareTestPage() {
  // Hardcoded sample data that matches a typical day card.
  const sampleData = {
    dateLabel: "Yesterday",
    monthShort: "MAY",
    dayNum: 4,
    displayName: "Joey Ross",
    username: "joeyross",
    workout: {
      type: "Leg day",
      duration: "45 min",
      calories: 420,
      exercises: [
        { name: "Goblet Squat", sets: 3, reps: 12, weight: "70 / 75 / 80 lbs" },
        { name: "Seated calf extension", sets: 3, reps: 12, weight: "220 / 230 / 240 lbs" },
        { name: "Glute leg extension", sets: 3, reps: 10, weight: "130 / 145 / 160 lbs" },
        { name: "Front squats", sets: 3, reps: 10, weight: "30 / 35 / 40 lbs" },
        { name: "Leg extension", sets: 3, reps: 10, weight: "185 / 205 / 225 lbs" },
        { name: "12 minute ab circuit", sets: 3, reps: 10, weight: "" },
      ],
      cardio: [
        { type: "Night run", duration: "29.32", distance: "1.78" },
      ],
    },
    nutrition: {
      calories: 1000,
      protein: 119,
      carbs: 5,
      fat: 40,
      meals: [
        { key: "Breakfast", name: "Protein shake", cal: 500, emoji: "🍽️" },
        { key: "Post-workout", name: "6 eggs w mozzarella cheese", cal: 500, emoji: "🍽️" },
      ],
      photoUrls: [],
    },
    wellness: {
      entries: [
        { activity: "Cold Plunge", emoji: "❄️", notes: "5 min", duration: 5 },
      ],
    },
  };

  return (
    <div style={{ padding: 40, color: "#fff", background: "#0D0D0D", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 20 }}>Share Button Test</h1>
      <p style={{ marginBottom: 20, color: "#9CA3AF" }}>
        Click the 📸 button below. A PNG should download to your Downloads folder.
        If the page does NOT crash and a file downloads, the share button is working.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 20, background: "#1A1230", borderRadius: 14 }}>
        <span>📸 Try the share button →</span>
        <ActivityShareButton data={sampleData} filename="share-test" />
      </div>
    </div>
  );
}
