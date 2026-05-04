// app/(app)/groups/[id]/layout.tsx
// See note in app/(app)/post/[id]/layout.tsx — required for static export.
// This layout wraps both `groups/[id]/page.tsx` AND
// `groups/[id]/challenges/page.tsx`, so one generateStaticParams covers both.
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
