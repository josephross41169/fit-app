// ── app/terms/page.tsx ──────────────────────────────────────────────────────
// Terms of Service — public page (no auth required).
// Apple requires a reachable ToS URL for App Store listings; this lives
// outside the (app) auth group so signed-out visitors can reach it too.
//
// IMPORTANT: This is a starting draft generated to satisfy Apple's
// submission requirement. Before full public launch, have a lawyer review
// it — particularly sections on user content ownership, dispute resolution,
// and liability. Fitness apps have unique liability exposure (injury claims).

export const metadata = {
  title: "Terms of Service · Livelee",
};

export default function TermsPage() {
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
      <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 32 }}>
        Last updated: April 23, 2026
      </p>

      <p style={{ marginBottom: 20 }}>
        Welcome to Livelee. By creating an account or using our services, you agree to these
        Terms of Service. Please read them carefully.
      </p>

      <Section title="1. Who We Are">
        Livelee is a social fitness and wellness platform operated by Joey Ross
        ("we", "us", "our"). The app is accessible at fit-app-ecru.vercel.app and
        through our iOS and Android applications.
      </Section>

      <Section title="2. Eligibility">
        You must be at least 13 years old to create an account. If you are under 18,
        you represent that you have your parent or legal guardian's permission to use
        the service. By signing up, you confirm that the information you provide is
        accurate and that you accept these Terms.
      </Section>

      <Section title="3. Your Account">
        You are responsible for maintaining the confidentiality of your login
        credentials and for all activities that occur under your account. Notify us
        immediately if you suspect unauthorized access. We may suspend or terminate
        accounts that violate these Terms.
      </Section>

      <Section title="4. User Content">
        You retain ownership of the photos, text, workout data, and other content you
        post to Livelee ("User Content"). By posting, you grant us a non-exclusive,
        worldwide, royalty-free license to store, display, and distribute your content
        within the service for the purpose of operating the app.
      </Section>

      <Section title="5. Acceptable Use">
        You agree not to use Livelee to post content that is illegal, harassing,
        hateful, obscene, violent, misleading, or infringes on others' rights. We
        reserve the right to remove any content and suspend any account at our
        discretion. Prohibited activities include:
        <ul style={{ marginTop: 10, marginBottom: 4, paddingLeft: 24 }}>
          <li>Harassment, threats, or bullying other users</li>
          <li>Impersonating another person or entity</li>
          <li>Posting sexually explicit or violent content</li>
          <li>Sharing dangerous fitness or nutrition advice that could cause harm</li>
          <li>Scraping, reverse-engineering, or abusing our API</li>
          <li>Buying, selling, or transferring accounts</li>
        </ul>
      </Section>

      <Section title="6. Reporting and Moderation">
        Users can report objectionable content or block other users at any time via
        the in-app reporting tools. We aim to review reports within 24 hours of
        submission. Accounts that repeatedly violate these Terms may be permanently
        banned.
      </Section>

      <Section title="7. Health Disclaimer">
        <strong>Livelee is not a medical service.</strong> The information, workouts,
        nutrition logs, and community content available through the app are provided
        for general informational and motivational purposes. You should consult a
        qualified healthcare professional before starting any exercise or nutrition
        program, particularly if you have an existing medical condition or take
        medication. We are not responsible for injuries or health outcomes resulting
        from your use of the service.
      </Section>

      <Section title="8. Third-Party Services">
        Livelee integrates with third-party services including Supabase (data
        storage), Vercel (hosting), and in the future may include fitness tracker
        integrations (Apple Health, Fitbit, Whoop, etc.). Your use of those services
        is subject to their own terms of service and privacy policies.
      </Section>

      <Section title="9. In-App Purchases">
        Livelee is free to use. We may introduce optional in-app purchases,
        subscriptions, or sponsored products in the future. Any such purchases will
        be clearly marked and subject to additional terms at the time of purchase.
        Purchases made through the Apple App Store or Google Play Store are governed
        by their respective policies.
      </Section>

      <Section title="10. Account Deletion">
        You may delete your account at any time from Settings → Delete Account. When
        you delete your account, we anonymize your personal information (name, email,
        avatar, bio). Posts you made may remain visible but will be attributed to
        "Deleted User". Some data may be retained in anonymized form for analytics
        and service improvement.
      </Section>

      <Section title="11. Limitation of Liability">
        To the fullest extent permitted by law, Livelee and its operators are not
        liable for indirect, incidental, or consequential damages arising from your
        use of the service. Our total liability for any claim relating to the service
        shall not exceed the greater of $100 USD or the amount you paid us in the
        12 months before the claim arose.
      </Section>

      <Section title="12. Changes to These Terms">
        We may modify these Terms from time to time. If we make material changes,
        we will notify you via the app or by email. Your continued use of Livelee
        after the changes take effect constitutes acceptance of the updated Terms.
      </Section>

      <Section title="13. Governing Law">
        These Terms are governed by the laws of the State of Nevada, United States,
        without regard to conflict-of-law principles. Any dispute arising from these
        Terms or the service will be resolved in the state or federal courts located
        in Clark County, Nevada.
      </Section>

      <Section title="14. Contact">
        Questions about these Terms? Email us at{" "}
        <a href="mailto:support@fitapp.example" style={{ color: "#A78BFA" }}>
          support@fitapp.example
        </a>
        . (Contact email to be updated before production launch.)
      </Section>

      <p style={{ marginTop: 32, fontSize: 13, color: "#6B7280" }}>
        By using Livelee, you acknowledge that you have read, understood, and agreed to
        be bound by these Terms of Service.
      </p>
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
