// Login / signup / password pages: keep everything below the iPhone
// status bar / Dynamic Island (0px on desktop).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ paddingTop: "var(--safe-top)", minHeight: "100vh", background: "#0E1311" }}>{children}</div>;
}
