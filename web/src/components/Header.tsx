"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionContext } from "@/lib/sessionContext";
import { LlmMode } from "@/lib/types";

interface HeaderProps {
  llmMode: LlmMode;
  onModeChange: (mode: LlmMode) => void;
  disabled?: boolean;
}

export function Header({ llmMode, onModeChange, disabled }: HeaderProps) {
  const pathname = usePathname();
  const { presenterMode, togglePresenterMode, isMockMode } = useSessionContext();

  const navLinks = [
    { href: "/history", label: "HISTORY" },
    { href: "/world", label: "WORLD" },
    { href: "/benchmark", label: "BENCHMARK" },
    { href: "/how-it-works", label: "HOW IT WORKS" },
  ];

  return (
    <header className="border-b border-[#E8E2D8] bg-[#FBF8F3]/90 backdrop-blur-xs sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand + Tagline */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-baseline gap-2 group">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1B19]">
              Sawal
            </span>
            <span className="text-sm sm:text-base font-normal text-[#6B665E] font-[family-name:var(--font-noto-serif-devanagari)]">
              सवाल
            </span>
          </Link>

          <div className="hidden lg:block h-4 w-px bg-[#E8E2D8]" />

          <p className="hidden lg:block text-xs font-normal text-[#6B665E]">
            Every AI assistant either guesses or nags.{" "}
            <span className="text-[#1C1B19] font-medium">Sawal rehearses first.</span>
          </p>

          {isMockMode && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-[6px] bg-[#E6EFEE] text-[#17494D] border border-[#17494D]/30 font-semibold ml-1">
              MOCK DATA
            </span>
          )}
        </div>

        {/* Right: Controls & Secondary Nav */}
        <div className="flex items-center gap-3">
          {/* Presenter Pill */}
          <button
            type="button"
            onClick={togglePresenterMode}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-[8px] border transition-all cursor-pointer ${
              presenterMode
                ? "bg-[#17494D] text-white border-[#17494D]"
                : "bg-white text-[#6B665E] hover:text-[#1C1B19] border-[#E8E2D8] shadow-sawal-sm"
            }`}
            title="Toggle Presenter Mode (Key: P)"
          >
            <span className="font-bold text-[11px] opacity-70">P</span>
            <span>Presenter</span>
          </button>

          {/* Secondary Nav Links (Hidden in Presenter Mode) */}
          <nav
            aria-label="Secondary navigation"
            className="hidden md:flex items-center gap-3 hide-in-presenter"
          >
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[11px] font-mono tracking-wider transition-colors px-1 py-0.5 ${
                    isActive
                      ? "text-[#17494D] font-bold border-b-2 border-[#17494D]"
                      : "text-[#6B665E] hover:text-[#1C1B19]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Live | Replay Toggle */}
          <div
            role="group"
            aria-label="Execution mode toggle"
            className="inline-flex items-center rounded-[8px] border border-[#E8E2D8] bg-white p-0.5 shadow-sawal-sm"
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onModeChange("live")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans rounded-[6px] transition-colors cursor-pointer disabled:opacity-50 ${
                llmMode === "live"
                  ? "bg-[#E6EFEE] text-[#17494D] font-semibold"
                  : "text-[#6B665E] hover:text-[#1C1B19]"
              }`}
            >
              {/* Dot is ACCENT TEAL #17494D, NEVER GREEN */}
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "#17494D" }}
              />
              <span>Live</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onModeChange("replay")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-sans rounded-[6px] transition-colors cursor-pointer disabled:opacity-50 ${
                llmMode === "replay"
                  ? "bg-[#E6EFEE] text-[#17494D] font-semibold"
                  : "text-[#6B665E] hover:text-[#1C1B19]"
              }`}
            >
              <span>Replay</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
