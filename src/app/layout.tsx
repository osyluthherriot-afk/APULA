import type { Metadata } from "next";
import { ThemeScript } from "@/components/ThemeScript";
import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";

// Set static page metadata before Next streams root shell.
export const metadata: Metadata = {
  title: "APULA — Atmospheric Prediction & Unified Low-gravity Analysis",
  description:
    "NASA Space Apps (Project APULA) microgravity and partial-gravity combustion risk simulator backed by normalized NASA PSI flight data.",
};

// Wrap app root with pre-paint theme script and 3-theme context provider.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="clarity" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" suppressHydrationWarning />
        <ThemeScript />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
