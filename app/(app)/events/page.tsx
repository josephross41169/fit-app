"use client";
// ── app/(app)/events/page.tsx ──────────────────────────────────────────────
// Events list — main entry point at /events.
// Filterable by category + city. Defaults to upcoming events near user.
// "+ Create Event" button at top-right for creators.

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { EVENT_CATEGORIES, getEventCategory, formatEventCategory } from "@/lib/eventCategories";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  event_date: string;
  date_tbd: boolean;
  location_name: string | null;
  city: string | null;
  price: string;
  image_url: string | null;
  going_count: number;
  interested_count: number;
}

export default function EventsListPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [showPastEvents, setShowPastEvents] = useState(false);

  // Pre-fill city from user profile so the list is locally relevant
  useEffect(() => {
    const userCity = (user?.profile as any)?.city;
    if (userCity && !cityFilter) setCityFilter(userCity);
  }, [user]);

  useEffect(() => { loadEvents(); /* eslint-disable-next-line */ }, [categoryFilter, cityFilter, showPastEvents]);

  async function loadEvents() {
    setLoading(true);
    let query = supabase
      .from("events_with_counts")
      .select("*")
      .eq("is_public", true)
      .or("approved.is.null,approved.eq.true")
      .order("event_date", { ascending: true });

    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (!showPastEvents) {
      const now = new Date().toISOString();
      query = query.gte("event_date", now);
    }

    const { data } = await query.limit(100);
    setEvents(data || []);
    setLoading(false);
  }

  // Group events by month for better scanning
  const grouped = useMemo(() => {
    const buckets: Record<string, EventRow[]> = {};
    for (const e of events) {
      const d = new Date(e.event_date);
      const key = e.date_tbd ? "TBD" : `${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(e);
    }
    return Object.entries(buckets);
  }, [events]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 80 }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>📅 Events</h1>
          <Link href="/events/new" style={primaryBtn}>+ Create Event</Link>
        </div>
        <p style={{ color: C.sub, fontSize: 14, marginBottom: 24 }}>
          Discover what's happening locally. Get out, meet people, do something.
        </p>

        {/* Filters */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={inputStyle}>
                <option value="all">All Categories</option>
                {EVENT_CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input type="text" value={cityFilter} onChange={e => setCityFilter(e.target.value)} placeholder="Las Vegas" style={inputStyle} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.sub, cursor: "pointer" }}>
            <input type="checkbox" checked={showPastEvents} onChange={e => setShowPastEvents(e.target.checked)} style={{ accentColor: "#7C3AED" }} />
            Show past events
          </label>
        </div>

        {/* Quick category chips — visual shortcut to filter */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <Chip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>All</Chip>
          {EVENT_CATEGORIES.map(c => (
            <Chip key={c.key} active={categoryFilter === c.key} onClick={() => setCategoryFilter(c.key)}>
              {c.emoji} {c.label}
            </Chip>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: C.sub }}>Loading events...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: C.sub }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>No events found</div>
            <div style={{ fontSize: 14 }}>Try a different filter, or be the first to create one.</div>
            <Link href="/events/new" style={{ ...primaryBtn, display: "inline-block", marginTop: 18 }}>+ Create Event</Link>
          </div>
        ) : (
          <div>
            {grouped.map(([month, list]) => (
              <div key={month} style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
                  {month}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {list.map(e => <EventCard key={e.id} event={e} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const cat = getEventCategory(event.category);
  const date = new Date(event.event_date);
  const dateStr = event.date_tbd ? "Date TBD" : date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <Link href={`/events/${event.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", transition: "transform 0.15s", cursor: "pointer" }}
           onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
           onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
        {/* Image / banner */}
        <div style={{
          height: 140,
          background: event.image_url
            ? `url(${event.image_url}) center/cover`
            : `linear-gradient(135deg, #7C3AED, #A78BFA)`,
          position: "relative",
        }}>
          <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
            {cat.emoji} {cat.label}
          </div>
          <div style={{ position: "absolute", top: 10, right: 10, background: event.price === "Free" ? "#16A34A" : "rgba(0,0,0,0.7)", color: "#fff", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
            {event.price}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {event.title}
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>📅 {dateStr}</div>
          {event.location_name && (
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              📍 {event.location_name}
            </div>
          )}
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
            👥 {event.going_count} going · {event.interested_count} interested
          </div>
        </div>
      </div>
    </Link>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px",
      borderRadius: 99,
      border: `1.5px solid ${active ? "#7C3AED" : C.border}`,
      background: active ? "#2A1F4A" : C.card,
      color: active ? "#E9D5FF" : C.text,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
    }}>{children}</button>
  );
}

const C = {
  bg: "#0D0D0D",
  card: "#161A26",
  input: "#1F2333",
  border: "#2A2F42",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  muted: "#6B7280",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase",
  letterSpacing: 0.5, display: "block", marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: C.input,
  border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
  fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 12, border: "none",
  background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
  color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer",
  textDecoration: "none", display: "inline-block",
};
