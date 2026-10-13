"use client";

import React from "react";

export function EmptyState() {
  return (
    <div className="relative rounded-[12px] border border-[#E8E2D8] bg-white p-8 sm:p-14 text-center overflow-hidden shadow-sawal-sm">
      {/* Very faint static fork sketch behind it */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]"
        preserveAspectRatio="none"
        viewBox="0 0 800 300"
      >
        <path
          d="M 100 150 C 250 150, 300 70, 500 70 M 100 150 C 250 150, 300 110, 500 110 M 100 150 C 250 150, 300 150, 500 150 M 100 150 C 250 150, 300 190, 500 190 M 100 150 C 250 150, 300 230, 500 230"
          fill="none"
          stroke="#1C1B19"
          strokeWidth="3"
        />
        <circle cx="100" cy="150" r="8" fill="#1C1B19" />
        <circle cx="500" cy="70" r="6" fill="#1C1B19" />
        <circle cx="500" cy="110" r="6" fill="#1C1B19" />
        <circle cx="500" cy="150" r="6" fill="#1C1B19" />
        <circle cx="500" cy="190" r="6" fill="#1C1B19" />
        <circle cx="500" cy="230" r="6" fill="#1C1B19" />
      </svg>

      <div className="relative z-10 max-w-xl mx-auto space-y-3">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1B19] tracking-tight leading-snug">
          Say something vague. I&apos;ll try every reading before I act.
        </h2>
        <p className="text-sm sm:text-base text-[#6B665E] font-sans">
          Your request stays in rehearsal until the outcome is clear.
        </p>

        <div className="pt-3 text-xs font-mono text-[#6B665E]">
          Click any example chip above or press <kbd className="px-1.5 py-0.5 rounded bg-[#F4EFE7] border border-[#E8E2D8] font-bold text-[#1C1B19]">1-5</kbd> to launch.
        </div>
      </div>
    </div>
  );
}
