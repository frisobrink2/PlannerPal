import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PlannerPal · Ruimte voor je werk",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PlannerPal",
  },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  description: "Je persoonlijke assistent voor mail, taken en agenda.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#28624c",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
