// ── lib/businessTypes.ts ───────────────────────────────────────────────────
// Canonical catalog of business types. Used by:
//   - Signup form (dropdown options)
//   - Business profile page (type badge + icon)
//   - Business onboarding wizard (future)
//   - Discover/search by type (future)
//
// Adding a new type here requires updating the check constraint in the
// migration-business-accounts.sql — though we made it soft-enforced to
// avoid breaking older rows.

export interface BusinessType {
  key: string;
  label: string;
  emoji: string;        // placeholder until custom icons are built
  category: "fitness" | "wellness" | "nutrition" | "retail" | "services";
  /** Does this type typically have physical operating hours? */
  hasHours: boolean;
  /** Does this type typically have a physical address? */
  hasAddress: boolean;
}

export const BUSINESS_TYPES: BusinessType[] = [
  // ── FITNESS ───────────────────────────────────────
  { key: "gym",            label: "Gym",                   emoji: "🏋️", category: "fitness",  hasHours: true,  hasAddress: true  },
  { key: "yoga_studio",    label: "Yoga / Pilates Studio", emoji: "🧘", category: "fitness",  hasHours: true,  hasAddress: true  },
  { key: "boxing_gym",     label: "Boxing / MMA Gym",      emoji: "🥊", category: "fitness",  hasHours: true,  hasAddress: true  },
  { key: "crossfit_box",   label: "CrossFit Box",          emoji: "🤸", category: "fitness",  hasHours: true,  hasAddress: true  },
  { key: "running_club",   label: "Running Club",          emoji: "🏃", category: "fitness",  hasHours: false, hasAddress: false },
  { key: "swim_club",      label: "Pool / Swim Club",      emoji: "🏊", category: "fitness",  hasHours: true,  hasAddress: true  },
  { key: "sports_team",    label: "Sports Team",           emoji: "🏆", category: "fitness",  hasHours: false, hasAddress: false },

  // ── WELLNESS ──────────────────────────────────────
  { key: "spa",            label: "Spa / Wellness Center", emoji: "🧖", category: "wellness", hasHours: true,  hasAddress: true  },
  { key: "recovery_center",label: "Recovery Center",       emoji: "💆", category: "wellness", hasHours: true,  hasAddress: true  },

  // ── NUTRITION / SERVICES ──────────────────────────
  { key: "nutrition_brand",label: "Nutrition / Meal Prep", emoji: "🥗", category: "nutrition",hasHours: false, hasAddress: false },
  { key: "supplement_brand",label:"Supplement Brand",      emoji: "💊", category: "nutrition",hasHours: false, hasAddress: false },
  { key: "dietitian",      label: "Dietitian / Nutritionist",emoji:"🍎",category: "services", hasHours: true,  hasAddress: false },
  { key: "coach",          label: "Coach / Trainer",       emoji: "🧑‍🏫",category:"services", hasHours: false, hasAddress: false },

  // ── RETAIL ────────────────────────────────────────
  { key: "apparel_brand",  label: "Apparel Brand",         emoji: "🛍️", category: "retail",   hasHours: false, hasAddress: false },

  // ── FALLBACK ──────────────────────────────────────
  { key: "other",          label: "Other",                 emoji: "📍", category: "services", hasHours: false, hasAddress: false },
];

/** Look up a business type by key. Returns the "other" entry if unknown so UI never breaks. */
export function getBusinessType(key: string | null | undefined): BusinessType {
  if (!key) return BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
  return BUSINESS_TYPES.find(t => t.key === key) ?? BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
}

/** Is this user a business account? Pass in the users row or profile object. */
export function isBusinessAccount(userOrProfile: any): boolean {
  return userOrProfile?.account_type === "business";
}
