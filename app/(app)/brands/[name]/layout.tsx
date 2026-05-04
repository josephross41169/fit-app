// app/(app)/brands/[name]/layout.tsx
// See note in app/(app)/post/[id]/layout.tsx — required for static export.
export function generateStaticParams() {
  return [{ name: '_' }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
