// ── app/support/page.tsx ────────────────────────────────────────────────────
// Support / Help Center — public page (no auth required).
// Required by Apple for App Store submissions: every app must list a
// reachable Support URL where users can get help. Lives outside the (app)
// auth group so signed-out users (and Apple reviewers) can reach it too.

export const metadata = {
  title: "Support · Livelee",
};

export default function SupportPage() {
  return (
    <div style={{
      maxWidth: 760,
      margin: "0 auto",
      padding: "40px 24px 80px",
      color: "#E2E8F0",
      background: "#0D0D0D",
      minHeight: "100vh",
      lineHeight: 1.65,
      fontSize: 15,
    }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Support</h1>
      <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 32 }}>
        We're a small team and we read every message.
      </p>

      <Section title="Get in touch">
        Email us at{" "}
        <a href="mailto:support@liveleeapp.com" style={{ color: "#A78BFA" }}>
          support@liveleeapp.com
        </a>
        {" "}and we'll respond within 48 hours. For faster help, include screenshots
        and the device you're using (e.g. iPhone 15 Pro, iOS 17.4).
      </Section>

      <Section title="Common questions">
        <FAQ q="I can't sign in / I forgot my password.">
          Tap "Forgot password" on the login screen. We'll email you a reset link.
          If the email doesn't arrive within a few minutes, check your spam folder.
          Still stuck? Email us.
        </FAQ>

        <FAQ q="Can I delete my account?">
          Yes. Go to Settings → Account → Delete Account. This removes your profile,
          posts, and activity history. The action is permanent and can't be undone.
        </FAQ>

        <FAQ q="My workout / nutrition log isn't showing up.">
          Refresh the Profile page and check the date range filter. If it still
          isn't there, send us the date and time you logged it and we'll investigate.
        </FAQ>

        <FAQ q="How do I report inappropriate content or a user?">
          Tap the three-dot menu on any post or profile and select "Report". For
          urgent safety issues, email us directly with screenshots and we'll act
          within 24 hours.
        </FAQ>

        <FAQ q="The AI Food Scanner isn't working.">
          The scanner has a daily limit of 3 scans per user to keep costs sustainable.
          If you've hit that limit, the option will return tomorrow. If you've made
          fewer than 3 attempts and still see an error, email us with the photo you
          tried to scan.
        </FAQ>

        <FAQ q="How do I request a feature or report a bug?">
          We love feedback. Email{" "}
          <a href="mailto:support@liveleeapp.com" style={{ color: "#A78BFA" }}>
            support@liveleeapp.com
          </a>
          {" "}with "Feature Request" or "Bug Report" in the subject line.
        </FAQ>
      </Section>

      <Section title="Privacy &amp; Terms">
        Read our{" "}
        <a href="/privacy" style={{ color: "#A78BFA" }}>Privacy Policy</a>
        {" "}and{" "}
        <a href="/terms" style={{ color: "#A78BFA" }}>Terms of Service</a>.
      </Section>

      <p style={{ color: "#6B7280", fontSize: 12, marginTop: 48, textAlign: "center" }}>
        Livelee · liveleeapp.com
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: "#F0F0F0" }}>
        {title}
      </h2>
      <div style={{ color: "#CBD5E1" }}>{children}</div>
    </section>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #1F2937" }}>
      <div style={{ fontWeight: 700, color: "#F0F0F0", marginBottom: 6 }}>{q}</div>
      <div style={{ color: "#94A3B8", fontSize: 14 }}>{children}</div>
    </div>
  );
}
