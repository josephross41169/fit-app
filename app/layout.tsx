import type { Metadata } from "next";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "FIT ⚡ — Track. Connect. Compete.",
  description: "The fitness social app built for people who show up.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#16A34A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fit ⚡" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        <PWARegister />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
