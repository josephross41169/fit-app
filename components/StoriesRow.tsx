"use client";
import { mockStories } from "@/lib/mockData";

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const colors = ["#16A34A", "#22C55E", "#52C97A", "#6B9FFF", "#FF6B9D", "#9B6BFF"];

export default function StoriesRow() {
  return (
    <div className="flex gap-4 px-4 py-3 overflow-x-auto no-scrollbar">
      {mockStories.map((story, i) => (
        <button key={story.id}
          className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-transform">
          {/* Avatar ring */}
          <div className="p-0.5 rounded-full"
            style={{ background: story.isYou
              ? "linear-gradient(135deg, #16A34A, #22C55E)"
              : "linear-gradient(135deg, #16A34A, #22C55E)" }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white p-0.5">
              <div className="w-full h-full rounded-full flex items-center justify-center font-bold text-white text-sm"
                style={{ background: colors[i % colors.length] }}>
                {story.isYou ? "+" : getInitials(story.username)}
              </div>
            </div>
          </div>
          <span className="text-xs font-medium max-w-[56px] truncate"
            style={{ color: story.isYou ? "#16A34A" : "#6B7280" }}>
            {story.isYou ? "Add Story" : story.username}
          </span>
        </button>
      ))}
    </div>
  );
}
