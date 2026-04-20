"use client";
import { useState } from "react";
import { mockCompetitions } from "@/lib/mockData";

const TYPE_EMOJI: Record<string, string> = { steps: "🚶", strength: "💪", nutrition: "🥗" };

export default function CompetitionsPage() {
  const [joined, setJoined] = useState<string[]>([]);
  const active = mockCompetitions.filter(c => c.isActive);
  const browse = mockCompetitions.filter(c => !c.isActive);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#FFF8F0" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 pt-12 pb-4" style={{ borderColor: "#DDD6FE" }}>
        <h1 className="text-2xl font-black" style={{ color: "#1A1A1A" }}>Competitions 🏆</h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>Compete. Win. Level up.</p>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Active */}
        <div>
          <h2 className="text-lg font-bold mb-3" style={{ color: "#1A1A1A" }}>⚡ Active Challenges</h2>
          {active.map(comp => (
            <div key={comp.id} className="bg-white rounded-3xl p-5 shadow-sm mb-3" style={{ border: "1px solid #DDD6FE" }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: "#F3F0FF" }}>
                  {TYPE_EMOJI[comp.type]}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base" style={{ color: "#1A1A1A" }}>{comp.name}</h3>
                  <p className="text-sm" style={{ color: "#6B7280" }}>{comp.description}</p>
                </div>
                <div className="text-center flex-shrink-0">
                  <div className="text-2xl font-black" style={{ color: "#7C3AED" }}>{comp.daysLeft}</div>
                  <div className="text-xs" style={{ color: "#6B7280" }}>days left</div>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1" style={{ color: "#6B7280" }}>
                  <span>{comp.current}</span>
                  <span>Goal: {comp.target}</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: "#DDD6FE" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${comp.progress * 100}%`, background: "linear-gradient(90deg, #7C3AED, #A78BFA)" }} />
                </div>
                <div className="text-right text-xs mt-1 font-semibold" style={{ color: "#7C3AED" }}>{Math.round(comp.progress * 100)}%</div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "#6B7280" }}>👥 {comp.participants.toLocaleString()} competing</span>
                <span className="text-sm font-bold" style={{ color: "#A78BFA" }}>{comp.prize}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Browse */}
        <div>
          <h2 className="text-lg font-bold mb-3" style={{ color: "#1A1A1A" }}>Join a Challenge</h2>
          <div className="space-y-3">
            {browse.map(comp => (
              <div key={comp.id} className="bg-white rounded-3xl p-4 shadow-sm flex items-center gap-3" style={{ border: "1px solid #DDD6FE" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "#FFF8F0" }}>
                  {TYPE_EMOJI[comp.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm" style={{ color: "#1A1A1A" }}>{comp.name}</h3>
                  <p className="text-xs truncate" style={{ color: "#6B7280" }}>{comp.description}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>👥 {comp.participants.toLocaleString()} - {comp.daysLeft} days left</p>
                </div>
                <button
                  onClick={() => setJoined(j => j.includes(comp.id) ? j.filter(x => x !== comp.id) : [...j, comp.id])}
                  className="flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-bold transition-all"
                  style={joined.includes(comp.id)
                    ? { background: "#F3F0FF", color: "#7C3AED", border: "2px solid #7C3AED" }
                    : { background: "linear-gradient(135deg, #7C3AED, #A78BFA)", color: "white" }}>
                  {joined.includes(comp.id) ? "Joined ✓" : "Join"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


