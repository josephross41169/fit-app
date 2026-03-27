export const mockStories = [
  { id: "1", username: "You", isYou: true },
  { id: "2", username: "jake_lifts" },
  { id: "3", username: "sara_runs" },
  { id: "4", username: "mike_gains" },
  { id: "5", username: "lena_fit" },
  { id: "6", username: "chris_rx" },
];

export const mockPosts = [
  {
    id: "1", type: "workout",
    user: { username: "jake_lifts", full_name: "Jake Morrison" },
    content: {
      workout_type: "Push Day 💪",
      exercises: [
        { name: "Bench Press", sets: 4, reps: 8, weight: "185 lbs" },
        { name: "Shoulder Press", sets: 3, reps: 10, weight: "65 lbs" },
        { name: "Tricep Dips", sets: 3, reps: 12, weight: "BW" },
      ],
      duration: "52 min", calories_burned: 380,
    },
    caption: "Chest & shoulders on FIRE 🔥 PR on bench today!",
    likes: 47, comments: 8, liked: false,
    created_at: "2h ago",
  },
  {
    id: "2", type: "food",
    user: { username: "sara_runs", full_name: "Sara Chen" },
    content: {
      meal_name: "Post-Run Recovery Meal", meal_type: "Lunch",
      macros: { calories: 620, protein: 48, carbs: 72, fat: 14 },
      items: ["Grilled chicken breast", "Brown rice", "Avocado", "Mixed greens"],
    },
    caption: "Fueling after a 10K ✅ Hitting macros perfectly this week!",
    likes: 31, comments: 5, liked: true,
    created_at: "3h ago",
  },
  {
    id: "3", type: "workout",
    user: { username: "mike_gains", full_name: "Mike Davis" },
    content: {
      workout_type: "Leg Day 🦵",
      exercises: [
        { name: "Squats", sets: 5, reps: 5, weight: "275 lbs" },
        { name: "Romanian Deadlift", sets: 4, reps: 8, weight: "185 lbs" },
        { name: "Leg Press", sets: 3, reps: 12, weight: "360 lbs" },
      ],
      duration: "68 min", calories_burned: 510,
    },
    caption: "Nobody said leg day was easy. Worth it every time. 💪",
    likes: 89, comments: 14, liked: false,
    created_at: "5h ago",
  },
];

export const mockProfile = {
  username: "joey_fit", full_name: "Joey",
  bio: "Army vet | Fitness journey | Competing & thriving ⚡",
  stats: { posts: 24, followers: 312, following: 89, streak: 14 },
};

export const mockCompetitions = [
  {
    id: "c1", name: "March Step Challenge", type: "steps",
    description: "10,000 steps/day for 30 days",
    participants: 1847, daysLeft: 7, progress: 0.77,
    target: "300,000 steps", current: "231,000 steps",
    isActive: true, prize: "🏆 Champion Badge",
  },
  {
    id: "c2", name: "30-Day Push-Up Challenge", type: "strength",
    description: "100 push-ups every day this month",
    participants: 924, daysLeft: 12, progress: 0,
    target: "100/day", current: "Not started",
    isActive: false, prize: "🥇 Iron Badge",
  },
  {
    id: "c3", name: "Calorie Deficit Week", type: "nutrition",
    description: "Stay in a 500 cal deficit for 7 days",
    participants: 631, daysLeft: 4, progress: 0,
    target: "-500 cal/day", current: "Not started",
    isActive: false, prize: "🌟 Shred Badge",
  },
];
