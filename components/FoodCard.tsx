"use client";
import { useState } from "react";

interface FoodContent {
  meal_name: string;
  meal_type: string;
  macros: { calories: number; protein: number; carbs: number; fat: number };
  items: string[];
}

interface FoodCardProps {
  id: string;
  user: { username: string; full_name: string };
  content: FoodContent;
  caption: string;
  likes: number;
  comments: number;
  liked: boolean;
  created_at: string;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const macroBadges = [
  { key: "calories" as const, label: "Cal", color: "#7C3AED", bg: "#F3F0FF" },
  { key: "protein" as const, label: "Protein", color: "#4F8EF7", bg: "#EEF4FF" },
  { key: "carbs" as const, label: "Carbs", color: "#A78BFA", bg: "#FFF8ED" },
  { key: "fat" as const, label: "Fat", color: "#4ADE80", bg: "#F5F0FF" },
];

export default function FoodCard({
  user, content, caption, likes: initialLikes, comments, liked: initialLiked, created_at
}: FoodCardProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);

  const toggleLike = () => {
    setLiked((prev) => !prev);
    setLikes((prev) => liked ? prev - 1 : prev + 1);
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border"
      style={{ borderColor: "#DDD6FE" }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #A78BFA, #FF8C42)" }}>
          {getInitials(user.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: "#1A1A1A" }}>{user.full_name}</p>
          <p className="text-xs" style={{ color: "#6B7280" }}>@{user.username} � {created_at}</p>
        </div>
        <button className="text-gray-300 hover:text-gray-400 transition-colors">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Meal banner */}
      <div className="mx-4 mb-3 rounded-2xl px-4 py-3"
        style={{ background: "linear-gradient(135deg, #A78BFA, #FF8C42)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-base">{content.meal_name}</p>
            <p className="text-amber-100 text-xs mt-0.5">{content.meal_type}</p>
          </div>
          <div className="text-3xl">??</div>
        </div>
      </div>

      {/* Macro badges */}
      <div className="px-4 mb-3 grid grid-cols-4 gap-2">
        {macroBadges.map(({ key, label, color, bg }) => (
          <div key={key} className="rounded-xl p-2 text-center" style={{ background: bg }}>
            <p className="font-bold text-sm" style={{ color }}>
              {content.macros[key]}{key !== "calories" ? "g" : ""}
            </p>
            <p className="text-xs font-medium mt-0.5" style={{ color }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Food items */}
      <div className="px-4 mb-3">
        <div className="flex flex-wrap gap-2">
          {content.items.map((item, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: "#FFF8ED", color: "#A78BFA" }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Caption */}
      <p className="px-4 pb-3 text-sm" style={{ color: "#1A1A1A" }}>{caption}</p>

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3 border-t" style={{ borderColor: "#DDD6FE" }}>
        <button onClick={toggleLike}
          className="flex items-center gap-1.5 transition-all duration-150 active:scale-90">
          <svg viewBox="0 0 24 24"
            fill={liked ? "#7C3AED" : "none"}
            stroke={liked ? "#7C3AED" : "#6B7280"}
            strokeWidth="2" className="w-5 h-5">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: liked ? "#7C3AED" : "#6B7280" }}>
            {likes}
          </span>
        </button>
        <button className="flex items-center gap-1.5 transition-colors hover:opacity-70">
          <svg viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" className="w-5 h-5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: "#6B7280" }}>{comments}</span>
        </button>
        <button className="ml-auto transition-colors hover:opacity-70">
          <svg viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" className="w-5 h-5">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </div>
    </div>
  );
}


