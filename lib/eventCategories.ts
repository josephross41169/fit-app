// ── lib/eventCategories.ts ─────────────────────────────────────────────────
// Canonical event taxonomy. Two-level: category → subcategory.
// Used by:
//   - Event create form (dropdowns)
//   - Event detail page (badge display)
//   - Discover / Connect filters
//
// Adding a new category here is the only change needed — DB stores them as
// free strings so no migration required.

export interface EventSubcategory {
  key: string;
  label: string;
}

export interface EventCategory {
  key: string;
  label: string;
  emoji: string;
  /** Optional subcategories. If empty, no sub-dropdown shown. */
  subcategories: EventSubcategory[];
}

export const EVENT_CATEGORIES: EventCategory[] = [
  {
    key: "race",
    label: "Race",
    emoji: "🏃",
    subcategories: [
      { key: "5k", label: "5K" },
      { key: "10k", label: "10K" },
      { key: "half_marathon", label: "Half Marathon" },
      { key: "marathon", label: "Marathon" },
      { key: "trail", label: "Trail Run" },
      { key: "ultra", label: "Ultra Marathon" },
      { key: "triathlon", label: "Triathlon" },
      { key: "cycling", label: "Cycling Race" },
      { key: "obstacle", label: "Obstacle Race" },
      { key: "swim", label: "Open Water Swim" },
      { key: "fun_run", label: "Fun Run / Charity" },
    ],
  },
  {
    key: "class",
    label: "Class",
    emoji: "💪",
    subcategories: [
      { key: "bootcamp", label: "Bootcamp" },
      { key: "hiit", label: "HIIT" },
      { key: "crossfit", label: "CrossFit" },
      { key: "spin", label: "Spin / Cycling" },
      { key: "pilates", label: "Pilates" },
      { key: "yoga", label: "Yoga" },
      { key: "barre", label: "Barre" },
      { key: "dance", label: "Dance" },
      { key: "boxing", label: "Boxing" },
      { key: "kickboxing", label: "Kickboxing" },
      { key: "swim_class", label: "Swim Class" },
    ],
  },
  {
    key: "workshop",
    label: "Workshop",
    emoji: "🥋",
    subcategories: [
      { key: "form_clinic", label: "Form Clinic" },
      { key: "nutrition_workshop", label: "Nutrition Workshop" },
      { key: "recovery", label: "Recovery / Mobility" },
      { key: "meditation", label: "Meditation" },
      { key: "breathwork", label: "Breathwork" },
      { key: "running_form", label: "Running Form" },
      { key: "lifting_seminar", label: "Lifting Seminar" },
    ],
  },
  {
    key: "meetup",
    label: "Meetup",
    emoji: "🤝",
    subcategories: [
      { key: "group_run", label: "Group Run" },
      { key: "group_walk", label: "Group Walk" },
      { key: "hike", label: "Hike" },
      { key: "swim_meetup", label: "Swim Meetup" },
      { key: "cycling_meetup", label: "Cycling Group Ride" },
      { key: "climbing", label: "Climbing Meetup" },
      { key: "social", label: "Social Hangout" },
    ],
  },
  {
    key: "competition",
    label: "Competition",
    emoji: "🏆",
    subcategories: [
      { key: "powerlifting", label: "Powerlifting" },
      { key: "weightlifting", label: "Olympic Weightlifting" },
      { key: "bodybuilding", label: "Bodybuilding / Physique" },
      { key: "bouldering", label: "Bouldering / Climbing" },
      { key: "crossfit_comp", label: "CrossFit Competition" },
      { key: "boxing_match", label: "Boxing / MMA" },
      { key: "tournament", label: "Sport Tournament" },
    ],
  },
  {
    key: "wellness",
    label: "Wellness",
    emoji: "🧘",
    subcategories: [
      { key: "cold_plunge", label: "Cold Plunge" },
      { key: "sauna", label: "Sauna Session" },
      { key: "sound_bath", label: "Sound Bath" },
      { key: "spa_day", label: "Spa Day" },
      { key: "recovery_session", label: "Recovery Session" },
      { key: "wellness_retreat", label: "Wellness Retreat" },
    ],
  },
  {
    key: "nutrition",
    label: "Nutrition",
    emoji: "🥗",
    subcategories: [
      { key: "cooking_class", label: "Cooking Class" },
      { key: "tasting", label: "Healthy Food Tasting" },
      { key: "consult", label: "Nutrition Consult" },
      { key: "meal_prep_event", label: "Meal Prep Workshop" },
    ],
  },
  {
    key: "farmers_market",
    label: "Farmers Market",
    emoji: "🌿",
    subcategories: [],
  },
  {
    key: "open_house",
    label: "Open House",
    emoji: "🏟️",
    subcategories: [
      { key: "gym_tour", label: "Gym Tour" },
      { key: "free_trial", label: "Free Trial Class" },
      { key: "grand_opening", label: "Grand Opening" },
    ],
  },
  {
    key: "other",
    label: "Other",
    emoji: "📍",
    subcategories: [],
  },
];

/** Look up a category by key with fallback. */
export function getEventCategory(key: string | null | undefined): EventCategory {
  if (!key) return EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];
  return EVENT_CATEGORIES.find(c => c.key === key) ?? EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];
}

/** Look up a subcategory by parent key + sub key. */
export function getEventSubcategory(catKey: string | null | undefined, subKey: string | null | undefined): EventSubcategory | null {
  if (!catKey || !subKey) return null;
  const cat = getEventCategory(catKey);
  return cat.subcategories.find(s => s.key === subKey) ?? null;
}

/** Format category + subcategory for display: "Race · 5K" */
export function formatEventCategory(catKey: string | null | undefined, subKey: string | null | undefined): string {
  const cat = getEventCategory(catKey);
  const sub = getEventSubcategory(catKey, subKey);
  return sub ? `${cat.emoji} ${cat.label} · ${sub.label}` : `${cat.emoji} ${cat.label}`;
}
