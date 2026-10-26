import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PlannerPal · Ruimte voor je werk",
  description:
    "Een persoonlijke planner voor zelfstandige professionals. Interactieve demo.",
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
