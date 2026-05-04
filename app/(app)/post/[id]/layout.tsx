// app/(app)/post/[id]/layout.tsx
// Required for static export (mobile build): every dynamic [param] segment
// must export `generateStaticParams`. We emit a single placeholder shell so
// Next.js succeeds; at runtime in the Capacitor WebView, the page reads the
// real id via `useParams()` from the client-side router. No effect on web.
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
