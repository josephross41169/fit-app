"use client";
// ── app/(app)/events/new/page.tsx ──────────────────────────────────────────
// Create event form. Single page, all fields visible (no multi-step wizard).
// Saves to public.events then redirects to /events/[id].
//
// Accepts ?group_id=X in URL — when present, the new event is tied to that
// group and shows up under the group's events tab.

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { EVENT_CATEGORIES, getEventCategory } from "@/lib/eventCategories";

export default function CreateEventPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // If routed from a group page, the group_id is preserved so the event
  // shows up under that group's events tab too.
  const groupId = searchParams?.get("group_id") || null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("meetup");
  const [subcategory, setSubcategory] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dateTbd, setDateTbd] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("Free");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill city from user's profile
  useEffect(() => {
    const userCity = (user?.profile as any)?.city;
    if (userCity && !city) setCity(userCity);
  }, [user]);

  // Reset subcategory when category changes
  useEffect(() => { setSubcategory(""); }, [category]);

  const currentCategory = getEventCategory(category);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving) return;

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!dateTbd && (!eventDate || !eventTime)) {
      setError("Please pick a date and time, or check 'Date TBD'.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Build the event_date timestamp
      let eventDateIso: string;
      if (dateTbd) {
        // Stash a far-future placeholder so sorting still works; UI checks date_tbd
        eventDateIso = new Date("2099-12-31").toISOString();
      } else {
        eventDateIso = new Date(`${eventDate}T${eventTime}`).toISOString();
      }
      let endDateIso: string | null = null;
      if (!dateTbd && endDate && endTime) {
        endDateIso = new Date(`${endDate}T${endTime}`).toISOString();
      }

      // Upload image if provided
      let imageUrl: string | null = null;
      if (imageFile) {
        try {
          imageUrl = await uploadPhoto(imageFile, user.id, "events");
        } catch {
          // Non-fatal — event still gets created without image
        }
      }

      const maxNum = maxAttendees.trim() ? parseInt(maxAttendees, 10) : null;

      const { data, error: dbErr } = await supabase
        .from("events")
        .insert({
          creator_id: user.id,
          group_id: groupId,  // tie to group if routed from a group page
          title: title.trim(),
          description: description.trim() || null,
          category,
          subcategory: subcategory || null,
          event_date: eventDateIso,
          end_date: endDateIso,
          date_tbd: dateTbd,
          location_name: locationName.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          price: price.trim() || "Free",
          max_attendees: maxNum && maxNum > 0 ? maxNum : null,
          image_url: imageUrl,
          is_public: true,
          source: "user",
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      router.push(`/events/${data.id}`);
    } catch (err: any) {
      setError(err.message || "Couldn't create event. Try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 80 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        <Link href="/events" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-block", marginBottom: 16 }}>
          ← Back to Events
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, marginBottom: 6 }}>Create Event</h1>
        <p style={{ color: C.sub, fontSize: 14, marginBottom: 24 }}>
          Build community. Get people out. Make it happen.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Cover image */}
          <Card title="Cover Image">
            <label style={{ cursor: "pointer", display: "block" }}>
              <div style={{
                width: "100%", aspectRatio: "16/9",
                background: imagePreview ? `url(${imagePreview}) center/cover` : "linear-gradient(135deg, #7C3AED, #A78BFA)",
                border: `2px dashed ${C.border}`, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600,
              }}>
                {!imagePreview && "📷 Click to upload"}
              </div>
              <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
            </label>
          </Card>

          {/* Basics */}
          <Card title="Basics">
            <Field label="Event title *">
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Sunday Long Run · 10 miles" style={inputStyle} required />
            </Field>
            <Field label="Description" hint="What's it about? Who's it for? What should people bring?">
              <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="We meet at Sunset Park at 7am every Sunday for a steady-state long run. All paces welcome..." style={{ ...inputStyle, resize: "vertical" }} />
            </Field>
          </Card>

          {/* Category */}
          <Card title="Category">
            <div style={{ display: "grid", gridTemplateColumns: currentCategory.subcategories.length > 0 ? "1fr 1fr" : "1fr", gap: 10 }}>
              <Field label="Type *">
                <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                  {EVENT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                </select>
              </Field>
              {currentCategory.subcategories.length > 0 && (
                <Field label="Subcategory" hint="Optional — leave blank for general">
                  <select value={subcategory} onChange={e => setSubcategory(e.target.value)} style={inputStyle}>
                    <option value="">— None —</option>
                    {currentCategory.subcategories.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </Card>

          {/* Date & Time */}
          <Card title="Date & Time">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.sub, cursor: "pointer", marginBottom: 12 }}>
              <input type="checkbox" checked={dateTbd} onChange={e => setDateTbd(e.target.checked)} style={{ accentColor: "#7C3AED" }} />
              Date TBD (announce later)
            </label>
            {!dateTbd && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Start date *">
                    <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} required={!dateTbd} />
                  </Field>
                  <Field label="Start time *">
                    <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} style={inputStyle} required={!dateTbd} />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <Field label="End date" hint="Optional">
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="End time">
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
              </>
            )}
          </Card>

          {/* Location */}
          <Card title="Location">
            <Field label="Venue / location name">
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Sunset Park · Pavilion 3" style={inputStyle} />
            </Field>
            <Field label="Address" hint="Used to link to maps">
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="2601 Sunset Rd, Las Vegas, NV 89120" style={inputStyle} />
            </Field>
            <Field label="City *" hint="Used for local discovery">
              <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Las Vegas, NV" style={inputStyle} required />
            </Field>
          </Card>

          {/* Pricing & capacity */}
          <Card title="Pricing & Capacity">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Price" hint="'Free', '$25', '$10–$50', etc.">
                <input type="text" value={price} onChange={e => setPrice(e.target.value)} placeholder="Free" style={inputStyle} />
              </Field>
              <Field label="Max attendees" hint="Leave blank for unlimited">
                <input type="number" min="1" value={maxAttendees} onChange={e => setMaxAttendees(e.target.value)} placeholder="50" style={inputStyle} />
              </Field>
            </div>
          </Card>

          {error && (
            <div style={{ background: "#2A0F0F", border: "1px solid #DC2626", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#FCA5A5" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} style={{
            padding: "14px", borderRadius: 14, border: "none",
            background: saving ? "#4B1D8A" : "linear-gradient(135deg, #7C3AED, #A78BFA)",
            color: "#fff", fontWeight: 900, fontSize: 16,
            cursor: saving ? "not-allowed" : "pointer",
            marginTop: 8,
          }}>
            {saving ? "Creating..." : "🚀 Create Event"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const C = {
  bg: "#0D0D0D", card: "#161A26", input: "#1F2333", border: "#2A2F42",
  text: "#F0F0F0", sub: "#9CA3AF",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", background: C.input,
  border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
  fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};
