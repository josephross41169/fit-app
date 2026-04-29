// ── app/privacy/page.tsx ────────────────────────────────────────────────────
// Privacy Policy — public page.
// Required by Apple + Google Play + CCPA/GDPR for apps that collect data.
//
// IMPORTANT: This is a drafted starting point. Before public launch:
//   - Have a lawyer review (fitness apps have health-data nuances)
//   - Confirm the App Privacy "nutrition label" on App Store Connect
//     matches what's described here
//   - Register for GDPR if you plan EU users (separate DPO requirements)
//   - Register for CCPA "Do Not Sell" if monetizing with ads later

export const metadata = {
  title: "Privacy Policy · Livelee",
};

export default function PrivacyPage() {
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
      <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 32 }}>
        Last updated: April 23, 2026
      </p>

      <p style={{ marginBottom: 20 }}>
        This Privacy Policy describes how Livelee ("we", "us", "our") collects,
        uses, and shares personal information when you use our service.
      </p>

      <Section title="1. Information We Collect">
        <strong>Information you provide directly:</strong>
        <ul style={{ marginTop: 8, marginBottom: 14, paddingLeft: 24 }}>
          <li>Account information: name, username, email, password (encrypted), birth date, city</li>
          <li>Profile content: avatar, banner photo, bio</li>
          <li>Activity data: workouts, nutrition logs, wellness sessions, photos, captions, comments</li>
          <li>Social graph: who you follow, block, or message</li>
          <li>Messages you send to other users</li>
          <li>Reports you submit about other users or content</li>
        </ul>
        <strong>Information collected automatically:</strong>
        <ul style={{ marginTop: 8, marginBottom: 4, paddingLeft: 24 }}>
          <li>Device and usage data: device type, operating system, app version</li>
          <li>Log data: IP address (temporarily), timestamps, error reports</li>
          <li>Analytics: screens visited, features used (anonymized where possible)</li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Information">
        We use your information to:
        <ul style={{ marginTop: 8, marginBottom: 4, paddingLeft: 24 }}>
          <li>Provide and operate the service (show your feed, track your workouts, etc.)</li>
          <li>Authenticate you and secure your account</li>
          <li>Connect you with other users through follows, groups, and messages</li>
          <li>Enforce our Terms of Service and investigate reports</li>
          <li>Send important service notifications (account changes, safety alerts)</li>
          <li>Improve the service (bug fixes, new features, usability)</li>
          <li>Comply with legal obligations</li>
        </ul>
      </Section>

      <Section title="3. Sharing Your Information">
        We do <strong>not</strong> sell your personal information. We share information
        only in these limited situations:
        <ul style={{ marginTop: 8, marginBottom: 4, paddingLeft: 24 }}>
          <li>
            <strong>With other users:</strong> Your profile, posts, and public activity
            are visible to other users of Livelee depending on your privacy settings.
          </li>
          <li>
            <strong>Service providers:</strong> We use Supabase (database, authentication,
            storage), Vercel (hosting), and similar infrastructure providers. They
            process data on our behalf under strict contractual protections.
          </li>
          <li>
            <strong>Legal requirements:</strong> If required by law, court order, or to
            protect the rights, safety, or property of Livelee or its users.
          </li>
          <li>
            <strong>Business transfers:</strong> If Livelee is acquired or merged, user
            data may transfer to the new entity, subject to this Policy.
          </li>
        </ul>
      </Section>

      <Section title="4. Your Rights and Choices">
        You can:
        <ul style={{ marginTop: 8, marginBottom: 4, paddingLeft: 24 }}>
          <li>Access and update your profile from within the app at any time</li>
          <li>Delete your account from Settings → Delete Account</li>
          <li>Block other users to prevent them from contacting you</li>
          <li>Report abusive content or users for review</li>
          <li>Opt out of non-essential push notifications in your device settings</li>
          <li>Request a copy of your data by emailing us (see Contact below)</li>
        </ul>
        Residents of California, Europe, and certain other regions have additional
        rights under CCPA, GDPR, or similar laws. Contact us to exercise these rights.
      </Section>

      <Section title="5. Data Retention">
        We retain your data for as long as your account is active. When you delete
        your account, we anonymize identifying information (name, email, avatar) but
        may retain some data in anonymized form for analytics, fraud prevention, or
        legal compliance. Reports submitted against other users are retained to
        inform moderation decisions, even after your account is deleted.
      </Section>

      <Section title="6. Data Security">
        We use industry-standard measures to protect your information, including
        encryption in transit (HTTPS) and at rest, hashed passwords, and access
        controls. However, no method of transmission or storage is 100% secure. In
        the event of a data breach, we will notify affected users as required by law.
      </Section>

      <Section title="7. Children's Privacy">
        Livelee is not intended for children under 13. We do not knowingly collect
        personal information from children under 13. If we learn that we have
        collected data from a child under 13, we will delete it promptly. Parents
        who believe their child has submitted information can contact us to request
        deletion.
      </Section>

      <Section title="8. Health Data">
        Livelee collects fitness and wellness data including workout details,
        nutrition logs, and body measurements. This data is not treated as
        "Protected Health Information" under HIPAA — Livelee is not a covered
        healthcare entity. However, we treat health-related data with care and do
        not sell or share it for advertising purposes.
      </Section>

      <Section title="9. International Users">
        Livelee is operated from the United States. If you access the service from
        outside the United States, your data will be transferred to and processed
        in the United States. By using Livelee, you consent to this transfer.
      </Section>

      <Section title="10. Third-Party Services">
        The app may contain links to third-party websites or services (e.g., wearable
        integrations). We are not responsible for the privacy practices of those
        services. Review their policies before sharing your data with them.
      </Section>

      <Section title="11. Changes to This Policy">
        We may update this Privacy Policy periodically. If we make material changes,
        we will notify you via the app or by email. The "Last updated" date at the
        top reflects the most recent revision.
      </Section>

      <Section title="12. Contact Us">
        Questions or concerns about your privacy? Email us at{" "}
        <a href="mailto:privacy@fitapp.example" style={{ color: "#A78BFA" }}>
          privacy@fitapp.example
        </a>
        . (Contact email to be updated before production launch.)
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: "#F0F0F0" }}>
        {title}
      </h2>
      <div style={{ color: "#CBD5E1" }}>{children}</div>
    </div>
  );
}
