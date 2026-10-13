import type { Metadata } from "next";
import {
  Fraunces,
  Instrument_Sans,
  JetBrains_Mono,
  Noto_Serif_Devanagari,
} from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/sessionContext";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoSerifDevanagari = Noto_Serif_Devanagari({
  variable: "--font-noto-serif-devanagari",
  subsets: ["devanagari", "latin"],
  weight: ["400", "700"],
  display: "swap",
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
      className={`${fraunces.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} ${notoSerifDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#FBF8F3] text-[#1C1B19]">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
