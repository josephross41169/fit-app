// Fit App — Bundled Exercise Database
// ~300 exercises across all major muscle groups
// No API needed — local, instant, no rate limits

export type Equipment =
  | "Barbell"
  | "Dumbbell"
  | "Cable"
  | "Machine"
  | "Bodyweight"
  | "Kettlebell"
  | "Resistance Band"
  | "Smith Machine"
  | "EZ Bar"
  | "Trap Bar"
  | "Pull-up Bar"
  | "Rings"
  | "None";

export type Category =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Forearms"
  | "Legs"
  | "Glutes"
  | "Core"
  | "Full Body"
  | "Cardio"
  | "Olympic"
  | "Stretching";

export interface Exercise {
  name: string;
  category: Category;
  equipment: Equipment;
  muscles: string[]; // primary + secondary
}

export const EXERCISES: Exercise[] = [
  // ── CHEST ──────────────────────────────────────────────────────────────────
  { name: "Bench Press", category: "Chest", equipment: "Barbell", muscles: ["Pectorals", "Triceps", "Anterior Deltoid"] },
  { name: "Incline Bench Press", category: "Chest", equipment: "Barbell", muscles: ["Upper Pectorals", "Triceps", "Anterior Deltoid"] },
  { name: "Decline Bench Press", category: "Chest", equipment: "Barbell", muscles: ["Lower Pectorals", "Triceps"] },
  { name: "Close Grip Bench Press", category: "Chest", equipment: "Barbell", muscles: ["Triceps", "Pectorals"] },
  { name: "Dumbbell Bench Press", category: "Chest", equipment: "Dumbbell", muscles: ["Pectorals", "Triceps", "Anterior Deltoid"] },
  { name: "Incline Dumbbell Press", category: "Chest", equipment: "Dumbbell", muscles: ["Upper Pectorals", "Triceps"] },
  { name: "Decline Dumbbell Press", category: "Chest", equipment: "Dumbbell", muscles: ["Lower Pectorals", "Triceps"] },
  { name: "Dumbbell Fly", category: "Chest", equipment: "Dumbbell", muscles: ["Pectorals", "Anterior Deltoid"] },
  { name: "Incline Dumbbell Fly", category: "Chest", equipment: "Dumbbell", muscles: ["Upper Pectorals"] },
  { name: "Cable Fly", category: "Chest", equipment: "Cable", muscles: ["Pectorals"] },
  { name: "High Cable Fly", category: "Chest", equipment: "Cable", muscles: ["Lower Pectorals"] },
  { name: "Low Cable Fly", category: "Chest", equipment: "Cable", muscles: ["Upper Pectorals"] },
  { name: "Pec Deck Machine", category: "Chest", equipment: "Machine", muscles: ["Pectorals"] },
  { name: "Chest Press Machine", category: "Chest", equipment: "Machine", muscles: ["Pectorals", "Triceps"] },
  { name: "Push-Up", category: "Chest", equipment: "Bodyweight", muscles: ["Pectorals", "Triceps", "Core"] },
  { name: "Wide Push-Up", category: "Chest", equipment: "Bodyweight", muscles: ["Outer Pectorals"] },
  { name: "Diamond Push-Up", category: "Chest", equipment: "Bodyweight", muscles: ["Triceps", "Inner Pectorals"] },
  { name: "Dips (Chest)", category: "Chest", equipment: "Bodyweight", muscles: ["Lower Pectorals", "Triceps"] },
  { name: "Smith Machine Bench Press", category: "Chest", equipment: "Smith Machine", muscles: ["Pectorals", "Triceps"] },
  { name: "Landmine Press", category: "Chest", equipment: "Barbell", muscles: ["Upper Pectorals", "Anterior Deltoid"] },

  // ── BACK ───────────────────────────────────────────────────────────────────
  { name: "Deadlift", category: "Back", equipment: "Barbell", muscles: ["Erector Spinae", "Glutes", "Hamstrings", "Lats", "Traps"] },
  { name: "Romanian Deadlift", category: "Back", equipment: "Barbell", muscles: ["Hamstrings", "Glutes", "Erector Spinae"] },
  { name: "Sumo Deadlift", category: "Back", equipment: "Barbell", muscles: ["Glutes", "Inner Thighs", "Hamstrings", "Erector Spinae"] },
  { name: "Trap Bar Deadlift", category: "Back", equipment: "Trap Bar", muscles: ["Glutes", "Quads", "Hamstrings", "Erector Spinae"] },
  { name: "Barbell Row", category: "Back", equipment: "Barbell", muscles: ["Lats", "Rhomboids", "Biceps", "Rear Deltoid"] },
  { name: "Pendlay Row", category: "Back", equipment: "Barbell", muscles: ["Lats", "Rhomboids", "Erector Spinae"] },
  { name: "Dumbbell Row", category: "Back", equipment: "Dumbbell", muscles: ["Lats", "Rhomboids", "Biceps"] },
  { name: "Chest Supported Row", category: "Back", equipment: "Dumbbell", muscles: ["Rhomboids", "Rear Deltoid", "Lats"] },
  { name: "Cable Row", category: "Back", equipment: "Cable", muscles: ["Lats", "Rhomboids", "Biceps"] },
  { name: "Wide Grip Cable Row", category: "Back", equipment: "Cable", muscles: ["Lats", "Rear Deltoid"] },
  { name: "Pull-Up", category: "Back", equipment: "Pull-up Bar", muscles: ["Lats", "Biceps", "Rhomboids"] },
  { name: "Chin-Up", category: "Back", equipment: "Pull-up Bar", muscles: ["Lats", "Biceps"] },
  { name: "Wide Grip Pull-Up", category: "Back", equipment: "Pull-up Bar", muscles: ["Outer Lats"] },
  { name: "Lat Pulldown", category: "Back", equipment: "Cable", muscles: ["Lats", "Biceps"] },
  { name: "Wide Grip Lat Pulldown", category: "Back", equipment: "Cable", muscles: ["Outer Lats"] },
  { name: "Close Grip Lat Pulldown", category: "Back", equipment: "Cable", muscles: ["Inner Lats", "Biceps"] },
  { name: "Straight Arm Pulldown", category: "Back", equipment: "Cable", muscles: ["Lats", "Triceps Long Head"] },
  { name: "T-Bar Row", category: "Back", equipment: "Barbell", muscles: ["Lats", "Rhomboids", "Biceps"] },
  { name: "Seated Cable Row", category: "Back", equipment: "Cable", muscles: ["Lats", "Rhomboids", "Biceps"] },
  { name: "Face Pull", category: "Back", equipment: "Cable", muscles: ["Rear Deltoid", "Rotator Cuff", "Rhomboids"] },
  { name: "Shrugs", category: "Back", equipment: "Barbell", muscles: ["Traps"] },
  { name: "Dumbbell Shrugs", category: "Back", equipment: "Dumbbell", muscles: ["Traps"] },
  { name: "Good Morning", category: "Back", equipment: "Barbell", muscles: ["Erector Spinae", "Hamstrings"] },
  { name: "Back Extension", category: "Back", equipment: "Machine", muscles: ["Erector Spinae", "Glutes"] },
  { name: "Inverted Row", category: "Back", equipment: "Bodyweight", muscles: ["Lats", "Rhomboids", "Biceps"] },

  // ── SHOULDERS ──────────────────────────────────────────────────────────────
  { name: "Overhead Press", category: "Shoulders", equipment: "Barbell", muscles: ["Anterior Deltoid", "Lateral Deltoid", "Triceps"] },
  { name: "Push Press", category: "Shoulders", equipment: "Barbell", muscles: ["Anterior Deltoid", "Triceps", "Legs"] },
  { name: "Seated Dumbbell Press", category: "Shoulders", equipment: "Dumbbell", muscles: ["Anterior Deltoid", "Lateral Deltoid", "Triceps"] },
  { name: "Arnold Press", category: "Shoulders", equipment: "Dumbbell", muscles: ["All Deltoid Heads", "Triceps"] },
  { name: "Lateral Raise", category: "Shoulders", equipment: "Dumbbell", muscles: ["Lateral Deltoid"] },
  { name: "Cable Lateral Raise", category: "Shoulders", equipment: "Cable", muscles: ["Lateral Deltoid"] },
  { name: "Machine Lateral Raise", category: "Shoulders", equipment: "Machine", muscles: ["Lateral Deltoid"] },
  { name: "Front Raise", category: "Shoulders", equipment: "Dumbbell", muscles: ["Anterior Deltoid"] },
  { name: "Cable Front Raise", category: "Shoulders", equipment: "Cable", muscles: ["Anterior Deltoid"] },
  { name: "Rear Delt Fly", category: "Shoulders", equipment: "Dumbbell", muscles: ["Rear Deltoid", "Rhomboids"] },
  { name: "Reverse Pec Deck", category: "Shoulders", equipment: "Machine", muscles: ["Rear Deltoid"] },
  { name: "Upright Row", category: "Shoulders", equipment: "Barbell", muscles: ["Lateral Deltoid", "Traps"] },
  { name: "Machine Shoulder Press", category: "Shoulders", equipment: "Machine", muscles: ["Anterior Deltoid", "Triceps"] },
  { name: "Smith Machine Overhead Press", category: "Shoulders", equipment: "Smith Machine", muscles: ["Anterior Deltoid", "Triceps"] },

  // ── BICEPS ─────────────────────────────────────────────────────────────────
  { name: "Barbell Curl", category: "Biceps", equipment: "Barbell", muscles: ["Biceps", "Brachialis"] },
  { name: "EZ Bar Curl", category: "Biceps", equipment: "EZ Bar", muscles: ["Biceps", "Brachialis"] },
  { name: "Dumbbell Curl", category: "Biceps", equipment: "Dumbbell", muscles: ["Biceps"] },
  { name: "Hammer Curl", category: "Biceps", equipment: "Dumbbell", muscles: ["Brachialis", "Brachioradialis", "Biceps"] },
  { name: "Incline Dumbbell Curl", category: "Biceps", equipment: "Dumbbell", muscles: ["Long Head Biceps"] },
  { name: "Concentration Curl", category: "Biceps", equipment: "Dumbbell", muscles: ["Biceps Peak"] },
  { name: "Cable Curl", category: "Biceps", equipment: "Cable", muscles: ["Biceps"] },
  { name: "Rope Hammer Curl", category: "Biceps", equipment: "Cable", muscles: ["Brachialis", "Brachioradialis"] },
  { name: "Preacher Curl", category: "Biceps", equipment: "EZ Bar", muscles: ["Biceps Short Head"] },
  { name: "Machine Curl", category: "Biceps", equipment: "Machine", muscles: ["Biceps"] },
  { name: "Spider Curl", category: "Biceps", equipment: "Barbell", muscles: ["Biceps"] },
  { name: "21s", category: "Biceps", equipment: "Barbell", muscles: ["Biceps"] },
  { name: "Zottman Curl", category: "Biceps", equipment: "Dumbbell", muscles: ["Biceps", "Brachioradialis"] },

  // ── TRICEPS ────────────────────────────────────────────────────────────────
  { name: "Tricep Pushdown", category: "Triceps", equipment: "Cable", muscles: ["Triceps"] },
  { name: "Rope Pushdown", category: "Triceps", equipment: "Cable", muscles: ["Triceps Lateral Head"] },
  { name: "Overhead Tricep Extension", category: "Triceps", equipment: "Dumbbell", muscles: ["Triceps Long Head"] },
  { name: "Cable Overhead Extension", category: "Triceps", equipment: "Cable", muscles: ["Triceps Long Head"] },
  { name: "Skull Crushers", category: "Triceps", equipment: "EZ Bar", muscles: ["Triceps"] },
  { name: "Tricep Dips", category: "Triceps", equipment: "Bodyweight", muscles: ["Triceps", "Chest"] },
  { name: "Bench Dips", category: "Triceps", equipment: "Bodyweight", muscles: ["Triceps"] },
  { name: "Kickbacks", category: "Triceps", equipment: "Dumbbell", muscles: ["Triceps Lateral Head"] },
  { name: "Machine Tricep Extension", category: "Triceps", equipment: "Machine", muscles: ["Triceps"] },
  { name: "JM Press", category: "Triceps", equipment: "Barbell", muscles: ["Triceps"] },
  { name: "Tate Press", category: "Triceps", equipment: "Dumbbell", muscles: ["Triceps"] },
  { name: "One Arm Cable Pushdown", category: "Triceps", equipment: "Cable", muscles: ["Triceps"] },

  // ── LEGS ───────────────────────────────────────────────────────────────────
  { name: "Squat", category: "Legs", equipment: "Barbell", muscles: ["Quads", "Glutes", "Hamstrings", "Core"] },
  { name: "Front Squat", category: "Legs", equipment: "Barbell", muscles: ["Quads", "Core"] },
  { name: "Goblet Squat", category: "Legs", equipment: "Kettlebell", muscles: ["Quads", "Glutes"] },
  { name: "Bulgarian Split Squat", category: "Legs", equipment: "Dumbbell", muscles: ["Quads", "Glutes", "Hamstrings"] },
  { name: "Hack Squat", category: "Legs", equipment: "Machine", muscles: ["Quads", "Glutes"] },
  { name: "Smith Machine Squat", category: "Legs", equipment: "Smith Machine", muscles: ["Quads", "Glutes"] },
  { name: "Leg Press", category: "Legs", equipment: "Machine", muscles: ["Quads", "Glutes", "Hamstrings"] },
  { name: "Leg Extension", category: "Legs", equipment: "Machine", muscles: ["Quads"] },
  { name: "Leg Curl (Lying)", category: "Legs", equipment: "Machine", muscles: ["Hamstrings"] },
  { name: "Leg Curl (Seated)", category: "Legs", equipment: "Machine", muscles: ["Hamstrings"] },
  { name: "Stiff Leg Deadlift", category: "Legs", equipment: "Barbell", muscles: ["Hamstrings", "Glutes", "Erector Spinae"] },
  { name: "Nordic Curl", category: "Legs", equipment: "Bodyweight", muscles: ["Hamstrings"] },
  { name: "Walking Lunges", category: "Legs", equipment: "Dumbbell", muscles: ["Quads", "Glutes", "Hamstrings"] },
  { name: "Reverse Lunges", category: "Legs", equipment: "Dumbbell", muscles: ["Quads", "Glutes"] },
  { name: "Step Ups", category: "Legs", equipment: "Dumbbell", muscles: ["Quads", "Glutes"] },
  { name: "Standing Calf Raise", category: "Legs", equipment: "Machine", muscles: ["Gastrocnemius"] },
  { name: "Seated Calf Raise", category: "Legs", equipment: "Machine", muscles: ["Soleus"] },
  { name: "Leg Press Calf Raise", category: "Legs", equipment: "Machine", muscles: ["Gastrocnemius", "Soleus"] },
  { name: "Box Jump", category: "Legs", equipment: "Bodyweight", muscles: ["Quads", "Glutes", "Calves"] },
  { name: "Wall Sit", category: "Legs", equipment: "Bodyweight", muscles: ["Quads"] },
  { name: "Sissy Squat", category: "Legs", equipment: "Bodyweight", muscles: ["Quads"] },

  // ── GLUTES ─────────────────────────────────────────────────────────────────
  { name: "Hip Thrust", category: "Glutes", equipment: "Barbell", muscles: ["Glutes", "Hamstrings"] },
  { name: "Dumbbell Hip Thrust", category: "Glutes", equipment: "Dumbbell", muscles: ["Glutes"] },
  { name: "Cable Kickback", category: "Glutes", equipment: "Cable", muscles: ["Glutes"] },
  { name: "Glute Bridge", category: "Glutes", equipment: "Bodyweight", muscles: ["Glutes", "Hamstrings"] },
  { name: "Banded Glute Bridge", category: "Glutes", equipment: "Resistance Band", muscles: ["Glutes"] },
  { name: "Abductor Machine", category: "Glutes", equipment: "Machine", muscles: ["Glutes", "Hip Abductors"] },
  { name: "Adductor Machine", category: "Glutes", equipment: "Machine", muscles: ["Hip Adductors", "Inner Thighs"] },
  { name: "Donkey Kick", category: "Glutes", equipment: "Bodyweight", muscles: ["Glutes"] },
  { name: "Fire Hydrant", category: "Glutes", equipment: "Bodyweight", muscles: ["Glutes", "Hip Abductors"] },
  { name: "Single Leg Hip Thrust", category: "Glutes", equipment: "Bodyweight", muscles: ["Glutes"] },
  { name: "Sumo Squat", category: "Glutes", equipment: "Dumbbell", muscles: ["Glutes", "Inner Thighs"] },

  // ── CORE ───────────────────────────────────────────────────────────────────
  { name: "Plank", category: "Core", equipment: "Bodyweight", muscles: ["Core", "Transverse Abdominis"] },
  { name: "Side Plank", category: "Core", equipment: "Bodyweight", muscles: ["Obliques", "Core"] },
  { name: "Crunch", category: "Core", equipment: "Bodyweight", muscles: ["Rectus Abdominis"] },
  { name: "Bicycle Crunch", category: "Core", equipment: "Bodyweight", muscles: ["Obliques", "Rectus Abdominis"] },
  { name: "Leg Raise", category: "Core", equipment: "Bodyweight", muscles: ["Lower Abs", "Hip Flexors"] },
  { name: "Hanging Leg Raise", category: "Core", equipment: "Pull-up Bar", muscles: ["Lower Abs", "Hip Flexors"] },
  { name: "Cable Crunch", category: "Core", equipment: "Cable", muscles: ["Rectus Abdominis"] },
  { name: "Russian Twist", category: "Core", equipment: "Bodyweight", muscles: ["Obliques"] },
  { name: "Weighted Russian Twist", category: "Core", equipment: "Dumbbell", muscles: ["Obliques"] },
  { name: "Ab Rollout", category: "Core", equipment: "Bodyweight", muscles: ["Core", "Lats"] },
  { name: "Dead Bug", category: "Core", equipment: "Bodyweight", muscles: ["Core", "Transverse Abdominis"] },
  { name: "Mountain Climber", category: "Core", equipment: "Bodyweight", muscles: ["Core", "Shoulders", "Quads"] },
  { name: "V-Up", category: "Core", equipment: "Bodyweight", muscles: ["Rectus Abdominis", "Hip Flexors"] },
  { name: "Toe Touch", category: "Core", equipment: "Bodyweight", muscles: ["Upper Abs"] },
  { name: "Dragon Flag", category: "Core", equipment: "Bodyweight", muscles: ["Core", "Lower Abs"] },
  { name: "Pallof Press", category: "Core", equipment: "Cable", muscles: ["Core", "Obliques"] },
  { name: "Hollow Body Hold", category: "Core", equipment: "Bodyweight", muscles: ["Core", "Lower Abs"] },
  { name: "Woodchop", category: "Core", equipment: "Cable", muscles: ["Obliques", "Core"] },
  { name: "Sit-Up", category: "Core", equipment: "Bodyweight", muscles: ["Rectus Abdominis", "Hip Flexors"] },
  { name: "Decline Sit-Up", category: "Core", equipment: "Bodyweight", muscles: ["Rectus Abdominis"] },

  // ── FULL BODY ──────────────────────────────────────────────────────────────
  { name: "Burpee", category: "Full Body", equipment: "Bodyweight", muscles: ["Full Body"] },
  { name: "Kettlebell Swing", category: "Full Body", equipment: "Kettlebell", muscles: ["Glutes", "Hamstrings", "Core", "Shoulders"] },
  { name: "Turkish Get-Up", category: "Full Body", equipment: "Kettlebell", muscles: ["Full Body", "Core", "Shoulders"] },
  { name: "Man Maker", category: "Full Body", equipment: "Dumbbell", muscles: ["Full Body"] },
  { name: "Thruster", category: "Full Body", equipment: "Barbell", muscles: ["Quads", "Glutes", "Shoulders", "Triceps"] },
  { name: "Bear Crawl", category: "Full Body", equipment: "Bodyweight", muscles: ["Core", "Shoulders", "Quads"] },
  { name: "Battle Ropes", category: "Full Body", equipment: "None", muscles: ["Shoulders", "Core", "Arms"] },
  { name: "Sled Push", category: "Full Body", equipment: "None", muscles: ["Quads", "Glutes", "Core"] },
  { name: "Sled Pull", category: "Full Body", equipment: "None", muscles: ["Hamstrings", "Back", "Core"] },
  { name: "Farmers Walk", category: "Full Body", equipment: "Dumbbell", muscles: ["Traps", "Forearms", "Core", "Legs"] },

  // ── OLYMPIC ────────────────────────────────────────────────────────────────
  { name: "Power Clean", category: "Olympic", equipment: "Barbell", muscles: ["Full Body", "Traps", "Glutes", "Quads"] },
  { name: "Clean and Jerk", category: "Olympic", equipment: "Barbell", muscles: ["Full Body"] },
  { name: "Snatch", category: "Olympic", equipment: "Barbell", muscles: ["Full Body"] },
  { name: "Hang Clean", category: "Olympic", equipment: "Barbell", muscles: ["Traps", "Glutes", "Quads", "Hamstrings"] },
  { name: "Push Jerk", category: "Olympic", equipment: "Barbell", muscles: ["Shoulders", "Triceps", "Quads"] },
  { name: "Muscle Up", category: "Olympic", equipment: "Pull-up Bar", muscles: ["Lats", "Chest", "Triceps"] },

  // ── FOREARMS ───────────────────────────────────────────────────────────────
  { name: "Wrist Curl", category: "Forearms", equipment: "Barbell", muscles: ["Forearm Flexors"] },
  { name: "Reverse Wrist Curl", category: "Forearms", equipment: "Barbell", muscles: ["Forearm Extensors"] },
  { name: "Reverse Curl", category: "Forearms", equipment: "Barbell", muscles: ["Brachioradialis", "Forearms"] },
  { name: "Plate Pinch", category: "Forearms", equipment: "None", muscles: ["Forearms", "Grip"] },
  { name: "Dead Hang", category: "Forearms", equipment: "Pull-up Bar", muscles: ["Forearms", "Grip", "Lats"] },

  // ── CARDIO ─────────────────────────────────────────────────────────────────
  { name: "Running", category: "Cardio", equipment: "None", muscles: ["Quads", "Hamstrings", "Calves", "Core"] },
  { name: "Cycling", category: "Cardio", equipment: "Machine", muscles: ["Quads", "Hamstrings", "Glutes"] },
  { name: "Rowing Machine", category: "Cardio", equipment: "Machine", muscles: ["Back", "Legs", "Core", "Arms"] },
  { name: "Jump Rope", category: "Cardio", equipment: "None", muscles: ["Calves", "Shoulders", "Core"] },
  { name: "Stair Climber", category: "Cardio", equipment: "Machine", muscles: ["Quads", "Glutes", "Calves"] },
  { name: "Elliptical", category: "Cardio", equipment: "Machine", muscles: ["Full Body"] },
  { name: "Swimming", category: "Cardio", equipment: "None", muscles: ["Full Body"] },
  { name: "HIIT", category: "Cardio", equipment: "None", muscles: ["Full Body"] },
  { name: "Assault Bike", category: "Cardio", equipment: "Machine", muscles: ["Full Body"] },
  { name: "Sprint Intervals", category: "Cardio", equipment: "None", muscles: ["Quads", "Hamstrings", "Glutes"] },
  { name: "Walking", category: "Cardio", equipment: "None", muscles: ["Quads", "Hamstrings", "Calves"] },
  { name: "Hiking", category: "Cardio", equipment: "None", muscles: ["Quads", "Glutes", "Calves"] },
  { name: "Boxing", category: "Cardio", equipment: "None", muscles: ["Shoulders", "Core", "Arms"] },
  { name: "Jump Squat", category: "Cardio", equipment: "Bodyweight", muscles: ["Quads", "Glutes", "Calves"] },
];

// ── HELPERS ────────────────────────────────────────────────────────────────

/** Filter exercises by search query (name or muscle) */
export function searchExercises(query: string, limit = 8): Exercise[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return EXERCISES.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.muscles.some((m) => m.toLowerCase().includes(q)) ||
      e.equipment.toLowerCase().includes(q)
  ).slice(0, limit);
}

/** Get all exercises for a category */
export function getByCategory(category: Category): Exercise[] {
  return EXERCISES.filter((e) => e.category === category);
}

/** Get all unique categories */
export const CATEGORIES: Category[] = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps",
  "Forearms", "Legs", "Glutes", "Core", "Full Body", "Cardio", "Olympic"
];

/** Get all unique equipment types */
export const EQUIPMENT_TYPES: Equipment[] = [
  "Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight",
  "Kettlebell", "Resistance Band", "EZ Bar", "Pull-up Bar"
];
