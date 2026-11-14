import type { Metadata } from "next";
import "./globals.css";

/**
 * Root metadata for APULA (Atmospheric Prediction & Unified Low-gravity Analysis).
 */
export const metadata: Metadata = {
  title: "APULA — Atmospheric Prediction & Unified Low-gravity Analysis",
  description:
    "NASA Space Apps (Project SIKLAB / ALAB) structural wireframe and physics logic harness for microgravity and partial-gravity combustion analysis.",
};

/**
 * Top-level App Router layout wrapping all pages with global Tailwind styles.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
