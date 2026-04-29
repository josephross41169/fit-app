import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import { AuthProvider } from "@/lib/auth";
import PostHogProvider from "@/components/PostHogProvider";

export const metadata: Metadata = {
  title: "Livelee — Track. Connect. Compete.",
  description: "The fitness and wellness social app built for people who show up.",
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
        <meta name="theme-color" content="#7C3AED" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Livelee" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        <PWARegister />
        {/* Suspense required because PostHogProvider uses useSearchParams,
            which suspends during streaming server rendering. */}
        <Suspense fallback={null}>
          <PostHogProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
