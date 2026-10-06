import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import ShellRouterPatch from "@/components/ShellRouterPatch";
import { AuthProvider } from "@/lib/auth";
import PostHogProvider from "@/components/PostHogProvider";

export const metadata: Metadata = {
  title: "Livelee — Track. Connect. Compete.",
  description: "The fitness and wellness social app built for people who show up.",
};

// Viewport is declared here (not as a <meta> in <head>) so Next.js doesn't
// add its own default viewport tag after ours. That default (no
// viewport-fit=cover) was overriding this one, which made iOS report a 0px
// safe area — so nothing could move below the notch / Dynamic Island.
// maximumScale 1 stops iOS auto-zooming into inputs; pinch zoom still works.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1F5F3F" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Livelee" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <PWARegister />
        {/* Suspense required because PostHogProvider uses useSearchParams,
            which suspends during streaming server rendering. */}
        <Suspense fallback={null}>
          <PostHogProvider>
            <AuthProvider>
              <ShellRouterPatch />
              {children}
            </AuthProvider>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
