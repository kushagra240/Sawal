import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sawal सवाल — Rehearse Before Acting",
  description:
    "Every AI assistant either guesses or nags. Sawal rehearses candidate readings in a sandbox first, then either acts or asks ONE question.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-100/60 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
        {children}
      </body>
    </html>
  );
}
